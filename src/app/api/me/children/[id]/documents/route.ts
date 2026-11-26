import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** GET: the papers the school has issued for this child: certificates and fee payments. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  const [certs, payments] = await Promise.all([
    prisma.certificate.findMany({
      where: { tenantId, studentId: child.id, status: "issued" },
    }),
    prisma.payment.findMany({
      where: { tenantId, invoice: { studentId: child.id }, amountPaise: { gt: 0 } },
      include: { invoice: { select: { title: true } } },
    }),
  ]);
  const docs = [
    ...certs.map((c) => ({
      id: c.id,
      kind: "Certificate",
      title: `${capital(c.type)} certificate`,
      reference: c.serialNo ?? "",
      date: dayStr(c.issuedOn),
    })),
    ...payments.map((p) => ({
      id: p.id,
      kind: "Fee payment",
      title: `${p.invoice.title} · ₹${new Intl.NumberFormat("en-IN").format(p.amountPaise / 100)}`,
      reference: p.receiptNo ?? p.reference ?? "",
      date: dayStr(p.paidOn),
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json(docs);
});
