import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET: one student's fee ledger, oldest first with a running balance. An invoice is a debit, a
 * payment a credit, and an approved refund (stored as a negative payment) a debit again, so the
 * balance is what the family still owes.
 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId } = await requireTenant([...FEE_ROLES]);
  const { id } = await ctx.params;
  const student = await prisma.student.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!student) throw new HttpError(404, "not_found", "Student not found.");
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, studentId: id },
    include: { payments: true },
  });

  const events: { id: string; at: Date; description: string; debit: number; credit: number }[] = [];
  for (const i of invoices) {
    events.push({
      id: i.id,
      at: i.createdAt,
      description: `${i.number} · ${i.title}`,
      debit: i.amountPaise / 100,
      credit: 0,
    });
    for (const p of i.payments) {
      const refund = p.amountPaise < 0;
      events.push({
        id: p.id,
        at: p.paidOn,
        description: refund ? `Refund · ${i.number}` : `Payment (${p.mode}) · ${i.number}`,
        debit: refund ? -p.amountPaise / 100 : 0,
        credit: refund ? 0 : p.amountPaise / 100,
      });
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  let balance = 0;
  const items = events.map((e) => {
    balance = Math.round((balance + e.debit - e.credit) * 100) / 100;
    return {
      id: e.id,
      date: e.at.toISOString().slice(0, 10),
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance,
    };
  });
  return NextResponse.json(items);
});
