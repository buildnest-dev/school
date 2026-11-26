import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { linesOf } from "@/server/payroll";

/** A staff member's own paid payslips. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const me = await prisma.staff.findFirst({ where: { tenantId, userId: user.id } });
  const rows = me
    ? await prisma.payslip.findMany({
        where: { tenantId, staffId: me.id, status: "paid" },
        orderBy: { month: "desc" },
        take: 36,
      })
    : [];
  return NextResponse.json(
    rows.map((s) => ({
      id: s.id,
      month: s.month,
      name: me!.name,
      employeeNo: me!.employeeNo,
      earnings: linesOf(s.earnings),
      deductions: linesOf(s.deductions),
      net: s.netPaise / 100,
    })),
  );
});
