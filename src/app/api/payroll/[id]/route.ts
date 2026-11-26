import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { linesOf, PAY_ROLES } from "@/server/payroll";

type Ctx = { params: Promise<{ id: string }> };

/** One payslip: for those who run payroll, or the person it belongs to once it is paid. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant();
  const slip = await prisma.payslip.findFirst({ where: { id: (await ctx.params).id, tenantId } });
  const staff = slip && (await prisma.staff.findFirst({ where: { id: slip.staffId, tenantId } }));
  const runs = (PAY_ROLES as readonly string[]).includes(user.role);
  if (!slip || !staff || (!runs && (staff.userId !== user.id || slip.status !== "paid")))
    throw new HttpError(404, "not_found", "Payslip not found.");
  return NextResponse.json({
    month: slip.month,
    name: staff.name,
    employeeNo: staff.employeeNo,
    earnings: linesOf(slip.earnings),
    deductions: linesOf(slip.deductions),
    net: slip.netPaise / 100,
  });
});

/** Marks a payslip paid (the money itself moves outside the app). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...PAY_ROLES]);
  const id = (await ctx.params).id;
  const { count } = await prisma.payslip.updateMany({
    where: { id, tenantId, status: "draft" },
    data: { status: "paid", paidOn: new Date() },
  });
  if (!count) throw new HttpError(404, "not_found", "No unpaid payslip found.");
  await prisma.auditLog.create({
    data: { tenantId, userId: user.id, action: "payroll.paid", entity: "payslip", entityId: id },
  });
  return NextResponse.json({ ok: true, message: "Marked as paid." });
});

/** Removes a draft so it can be made again after a correction. */
export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...PAY_ROLES]);
  const { count } = await prisma.payslip.deleteMany({
    where: { id: (await ctx.params).id, tenantId, status: "draft" },
  });
  if (!count) throw new HttpError(409, "paid", "A paid payslip is kept.");
  return NextResponse.json({ ok: true, message: "Draft removed." });
});
