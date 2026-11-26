import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { Lines, linesOf, netOf, PAY_ROLES } from "@/server/payroll";

const Month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use YYYY-MM");

export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...PAY_ROLES]);
  const month = Month.parse(new URL(req.url).searchParams.get("month") || todayIST().slice(0, 7));
  const [staff, structures, slips] = await Promise.all([
    prisma.staff.findMany({ where: { tenantId, status: "active" }, orderBy: { name: "asc" } }),
    prisma.salaryStructure.findMany({ where: { tenantId } }),
    prisma.payslip.findMany({ where: { tenantId, month } }),
  ]);
  return NextResponse.json({
    month,
    rows: staff.map((s) => {
      const structure = structures.find((x) => x.staffId === s.id);
      const slip = slips.find((x) => x.staffId === s.id);
      const earnings = structure ? linesOf(structure.earnings) : [];
      const deductions = structure ? linesOf(structure.deductions) : [];
      return {
        staffId: s.id,
        name: s.name,
        employeeNo: s.employeeNo,
        earnings,
        deductions,
        net: netOf(earnings, deductions),
        slip: slip
          ? {
              id: slip.id,
              status: slip.status,
              net: slip.netPaise / 100,
              earnings: linesOf(slip.earnings),
              deductions: linesOf(slip.deductions),
            }
          : null,
      };
    }),
  });
});

const Structure = z.object({
  staffId: z.string().min(1),
  earnings: Lines.min(1),
  deductions: Lines,
});

/** Sets one person's usual monthly pay. */
export const PUT = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...PAY_ROLES]);
  const b = Structure.parse(await req.json());
  if (!(await prisma.staff.findFirst({ where: { id: b.staffId, tenantId } })))
    throw new HttpError(404, "not_found", "Staff member not found.");
  if (netOf(b.earnings, b.deductions) < 0)
    throw new HttpError(422, "negative", "Deductions are more than the earnings.");
  const data = {
    earnings: JSON.stringify(b.earnings),
    deductions: JSON.stringify(b.deductions),
  };
  await prisma.$transaction([
    prisma.salaryStructure.upsert({
      where: { staffId: b.staffId },
      create: { tenantId, staffId: b.staffId, ...data },
      update: data,
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "payroll.structure",
        entity: "staff",
        entityId: b.staffId,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, message: "Salary saved." });
});

/** Makes the month's payslips for everyone with a salary who has none yet. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...PAY_ROLES]);
  const { month } = z.object({ month: Month }).parse(await req.json());
  if (month > todayIST().slice(0, 7))
    throw new HttpError(422, "future", "Payslips cannot be made for a future month.");
  const [structures, slips, staff] = await Promise.all([
    prisma.salaryStructure.findMany({ where: { tenantId } }),
    prisma.payslip.findMany({ where: { tenantId, month }, select: { staffId: true } }),
    prisma.staff.findMany({ where: { tenantId, status: "active" }, select: { id: true } }),
  ]);
  const done = new Set(slips.map((s) => s.staffId));
  const active = new Set(staff.map((s) => s.id));
  const todo = structures.filter((s) => active.has(s.staffId) && !done.has(s.staffId));
  await prisma.$transaction([
    ...todo.map((s) =>
      prisma.payslip.create({
        data: {
          tenantId,
          staffId: s.staffId,
          month,
          earnings: s.earnings,
          deductions: s.deductions,
          netPaise: netOf(linesOf(s.earnings), linesOf(s.deductions)) * 100,
        },
      }),
    ),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "payroll.generate",
        entity: "month",
        entityId: month,
      },
    }),
  ]);
  return NextResponse.json({
    ok: true,
    count: todo.length,
    message: `${todo.length} payslip(s) made.`,
  });
});
