import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { handle } from "@/server/http";
import { studentLedger } from "@/server/portal";

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
  return NextResponse.json(await studentLedger(tenantId, id));
});
