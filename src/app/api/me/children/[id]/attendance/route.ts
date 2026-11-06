import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

/** GET: attendance totals and the most recent days for one child. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  const rows = await prisma.attendance.findMany({
    where: { tenantId, studentId: child.id },
    orderBy: { date: "desc" },
  });
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  return NextResponse.json({
    presentDays: count("present"),
    absentDays: count("absent"),
    lateDays: count("late"),
    recent: rows
      .slice(0, 10)
      .map((r) => ({ date: r.date.toISOString().slice(0, 10), status: r.status })),
  });
});
