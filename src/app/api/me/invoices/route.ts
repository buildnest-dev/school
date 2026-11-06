import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { invoiceStatus, paidOf } from "@/server/fees";
import { handle } from "@/server/http";

/** GET: every invoice of the signed-in parent's children, with what is paid and still due. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["parent"]);
  const rows = await prisma.invoice.findMany({
    where: { tenantId, student: { status: "active", guardian: { userId: user.id } } },
    orderBy: { dueOn: "asc" },
    include: { payments: true, student: { select: { id: true, name: true } } },
  });
  const items = rows.map((i) => {
    const paid = paidOf(i);
    return {
      id: i.id,
      number: i.number,
      studentId: i.student.id,
      studentName: i.student.name,
      title: i.title,
      amount: i.amountPaise / 100,
      discount: i.discountPaise / 100,
      paid: paid / 100,
      balance: Math.max(0, i.amountPaise - paid) / 100,
      due: i.dueOn.toISOString().slice(0, 10),
      status: invoiceStatus(i.amountPaise, paid, i.dueOn),
      payments: i.payments
        .filter((p) => p.amountPaise > 0)
        .map((p) => ({ id: p.id, amount: p.amountPaise / 100, mode: p.mode })),
    };
  });
  return NextResponse.json({
    items,
    totalBalance: items.reduce((s, i) => s + i.balance, 0),
  });
});
