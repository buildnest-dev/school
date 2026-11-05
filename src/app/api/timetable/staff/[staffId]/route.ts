import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { bellSchedule, periodInclude, periodView } from "@/server/timetable";

/** A teacher's own week. The principal and owner can read anyone's; a teacher only their own. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ staffId: string }> }) => {
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "teacher"]);
  const staff = await prisma.staff.findFirst({
    where: { id: (await ctx.params).staffId, tenantId },
  });
  if (!staff) throw new HttpError(404, "not_found", "Staff member not found.");
  if (user.role === "teacher" && staff.userId !== user.id)
    throw new HttpError(403, "forbidden", "You can only view your own timetable.");
  const [bell, periods] = await Promise.all([
    bellSchedule(tenantId),
    prisma.period.findMany({
      where: { tenantId, staffId: staff.id },
      include: periodInclude,
      orderBy: [{ day: "asc" }, { slot: "asc" }],
    }),
  ]);
  return NextResponse.json({
    staffId: staff.id,
    name: staff.name,
    bell,
    periods: periods.map(periodView),
  });
});
