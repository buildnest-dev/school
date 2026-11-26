import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { parseDay } from "@/server/lib";

const ROLES = ["school_owner", "principal", "vice_principal", "hr"] as const;
const STATUSES = ["present", "absent", "late", "half_day", "leave"] as const;

/** GET ?date= : every active staff member with that day's mark, plus this month's totals. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...ROLES]);
  const date = new URL(req.url).searchParams.get("date") || todayIST();
  const day = parseDay(date);
  const monthStart = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth() + 1, 1));
  const [staff, marks, month, leaves] = await Promise.all([
    prisma.staff.findMany({ where: { tenantId, status: "active" }, orderBy: { name: "asc" } }),
    prisma.staffAttendance.findMany({ where: { tenantId, date: day } }),
    prisma.staffAttendance.findMany({
      where: { tenantId, date: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.leaveRequest.findMany({
      where: { tenantId, status: "approved", fromDate: { lte: day }, toDate: { gte: day } },
    }),
  ]);
  const today = new Map(marks.map((m) => [m.staffId, m.status]));
  const onLeave = new Set(leaves.map((l) => l.userId));
  return NextResponse.json({
    date,
    saved: marks.length > 0,
    rows: staff.map((s) => {
      const mine = month.filter((m) => m.staffId === s.id);
      const leave = s.userId !== null && onLeave.has(s.userId);
      return {
        staffId: s.id,
        name: s.name,
        role: s.role,
        status: today.get(s.id) ?? (leave ? "leave" : "present"),
        onApprovedLeave: leave,
        monthPresent: mine.filter((m) => m.status === "present" || m.status === "late").length,
        monthAbsent: mine.filter((m) => m.status === "absent").length,
        monthLeave: mine.filter((m) => m.status === "leave" || m.status === "half_day").length,
      };
    }),
  });
});

const Body = z.object({
  date: z.string(),
  rows: z
    .array(z.object({ staffId: z.string().min(1), status: z.enum(STATUSES) }))
    .min(1)
    .max(500),
});

export const PUT = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...ROLES]);
  const b = Body.parse(await req.json());
  const day = parseDay(b.date);
  if (b.date > todayIST())
    throw new HttpError(422, "future", "Attendance cannot be marked for a future day.");
  const ids = new Set(
    (await prisma.staff.findMany({ where: { tenantId }, select: { id: true } })).map((s) => s.id),
  );
  if (b.rows.some((r) => !ids.has(r.staffId)))
    throw new HttpError(404, "not_found", "Staff member not found.");
  await prisma.$transaction([
    ...b.rows.map((r) =>
      prisma.staffAttendance.upsert({
        where: { staffId_date: { staffId: r.staffId, date: day } },
        create: { tenantId, staffId: r.staffId, date: day, status: r.status, markedBy: user.name },
        update: { status: r.status, markedBy: user.name },
      }),
    ),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "staff_attendance.save",
        entity: "day",
        entityId: b.date,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, message: "Staff attendance saved." });
});
