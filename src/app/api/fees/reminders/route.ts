import { NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@/server/accounts";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES, paidOf } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  /** Remind only for invoices at least this many days past their due date. */
  minOverdueDays: z.number().int().min(1).max(365).default(1),
  /** Do not remind again for an invoice reminded within this many days. */
  minGapDays: z.number().int().min(1).max(90).default(7),
  /** Default true: only count who would be reminded. */
  dryRun: z.boolean().default(true),
});

const DAY = 86_400_000;

/**
 * POST: finds overdue unpaid invoices and e-mails each guardian one reminder listing them. An
 * invoice that was reminded recently is left out, and a guardian with no e-mail is counted so the
 * school can phone them. E-mail goes to the Outbox until a mail provider is connected.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...FEE_ROLES]);
  const b = Body.parse(await req.json().catch(() => ({})));
  const now = Date.now();
  const invoices = await prisma.invoice.findMany({
    where: {
      tenantId,
      dueOn: { lt: new Date(now - b.minOverdueDays * DAY) },
      student: { status: "active" },
    },
    include: { payments: true, student: { include: { guardian: true } } },
  });
  const due = invoices.filter((i) => paidOf(i) < i.amountPaise);
  const recent = new Set(
    (
      await prisma.feeReminder.findMany({
        where: {
          tenantId,
          invoiceId: { in: due.map((i) => i.id) },
          sentAt: { gt: new Date(now - b.minGapDays * DAY) },
        },
        select: { invoiceId: true },
      })
    ).map((r) => r.invoiceId),
  );
  const fresh = due.filter((i) => !recent.has(i.id));

  const byGuardian = new Map<string, typeof fresh>();
  let noContact = 0;
  for (const i of fresh) {
    const g = i.student.guardian;
    if (!g?.email) {
      noContact++;
      continue;
    }
    byGuardian.set(g.email, [...(byGuardian.get(g.email) ?? []), i]);
  }
  const summary = {
    overdueInvoices: due.length,
    recentlyReminded: recent.size,
    guardiansToEmail: byGuardian.size,
    invoicesToRemind: fresh.length - noContact,
    withoutEmail: noContact,
  };
  if (b.dryRun) return NextResponse.json({ ok: true, mode: "api", dryRun: true, ...summary });

  const school = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  for (const [email, list] of byGuardian) {
    const lines = list.map(
      (i) =>
        `- ${i.student.name}: ${i.title} (${i.number}), Rs ${((i.amountPaise - paidOf(i)) / 100).toFixed(2)} due since ${i.dueOn.toISOString().slice(0, 10)}`,
    );
    await sendMail({
      tenantId,
      to: email,
      subject: `Fee reminder from ${school.name}`,
      body: `Dear ${list[0]!.student.guardian!.name},\n\nThese fees are overdue:\n${lines.join("\n")}\n\nPlease pay them at the school or through the parent portal. If you have already paid, please ignore this message.\n`,
    });
    await prisma.feeReminder.createMany({
      data: list.map((i) => ({ tenantId, invoiceId: i.id })),
    });
  }
  await prisma.auditLog.create({
    data: { tenantId, userId: user.id, action: "fees.remind", entity: "invoice" },
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    dryRun: false,
    ...summary,
    sent: byGuardian.size,
  });
});
