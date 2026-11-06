import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { toDay, todayIST } from "@/server/homework";
import { daySlots, staffOf } from "@/server/portal";

/** GET: the teacher's day: how many classes, which attendance is still open, latest notices. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const me = await staffOf(tenantId, user.id);
  const today = todayIST();
  const slots = me ? await daySlots(tenantId, { staffId: me.id }, today) : [];
  const sectionIds = [...new Set(slots.map((s) => s.sectionId))];
  const [sheets, notices] = await Promise.all([
    prisma.attendanceSheet.findMany({
      where: { tenantId, sectionId: { in: sectionIds }, date: toDay(today), status: "submitted" },
      select: { sectionId: true },
    }),
    prisma.notice.findMany({
      where: { tenantId, status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: { id: true, title: true },
    }),
  ]);
  const done = new Set(sheets.map((s) => s.sectionId));
  const open = sectionIds.filter((id) => !done.has(id));
  const label = (id: string) => slots.find((s) => s.sectionId === id)?.classLabel ?? "";
  return NextResponse.json({
    greetingName: user.name.split(" ")[0],
    classesToday: slots.length,
    nextAttendanceClassId: open[0] ?? null,
    pending: open.map((id) => ({
      id,
      label: `Attendance for ${label(id)}`,
      href: `/teacher/attendance/${id}`,
    })),
    notices,
  });
});
