import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";
import { paidOf } from "@/server/fees";
import { toDay, todayIST } from "@/server/homework";

type Ctx = { params: Promise<{ id: string }> };

/** GET: what the family should know today: homework due, fees outstanding, the latest notice. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  const today = todayIST();
  const items: { id: string; text: string; kind: "homework" | "fee" | "notice" | "event" }[] = [];

  if (child.sectionId) {
    const hw = await prisma.homework.findMany({
      where: {
        tenantId,
        sectionId: child.sectionId,
        status: "published",
        dueOn: { gte: toDay(today) },
      },
      include: { subject: { select: { name: true } }, rows: { where: { studentId: child.id } } },
      orderBy: { dueOn: "asc" },
      take: 5,
    });
    for (const h of hw)
      if (h.rows[0]?.status !== "done")
        items.push({
          id: h.id,
          kind: "homework",
          text: `${h.subject.name}: ${h.title}, due ${h.dueOn.toISOString().slice(0, 10)}`,
        });
  }
  if (user.role === "parent") {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, studentId: child.id },
      include: { payments: true },
    });
    const due = invoices.reduce((s, i) => s + Math.max(0, i.amountPaise - paidOf(i)), 0);
    if (due > 0)
      items.push({
        id: "fees",
        kind: "fee",
        text: `Fees outstanding: ₹${new Intl.NumberFormat("en-IN").format(Math.round(due / 100))}`,
      });
  }
  const notice = await prisma.notice.findFirst({
    where: { tenantId, status: "published" },
    orderBy: { publishedAt: "desc" },
  });
  if (notice) items.push({ id: notice.id, kind: "notice", text: notice.title });

  return NextResponse.json({
    headline: items.length
      ? `${child.name}: ${items.length} thing(s) for today`
      : `${child.name}: nothing pending today`,
    items,
  });
});
