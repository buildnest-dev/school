import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { handle } from "@/server/http";

/** Meeting slots from today on. "booked" is true when anyone holds the slot, including this parent. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant(["parent"]);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const rows = await prisma.ptmSlot.findMany({
    where: { tenantId, date: { gte: today } },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return NextResponse.json(
    rows.map((s) => ({
      id: s.id,
      teacher: s.teacherName,
      date: dayStr(s.date),
      time: s.time,
      booked: !!s.bookedByUserId,
    })),
  );
});
