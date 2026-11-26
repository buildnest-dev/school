import { prisma } from "./db";
import { parseDay } from "./lib";
import { weekdayOf } from "./portal";

/** Everything needed to arrange cover for one day. */
export async function coverDay(tenantId: string, date: string) {
  const day = parseDay(date);
  const [teachers, periods, covers, marks, leaves, bells] = await Promise.all([
    prisma.staff.findMany({
      where: { tenantId, status: "active", role: "teacher" },
      orderBy: { name: "asc" },
    }),
    prisma.period.findMany({
      where: { tenantId, day: weekdayOf(date) },
      include: { subject: true, section: { include: { class: true } } },
      orderBy: { slot: "asc" },
    }),
    prisma.substitution.findMany({ where: { tenantId, date: day } }),
    prisma.staffAttendance.findMany({
      where: { tenantId, date: day, status: { in: ["absent", "leave"] } },
    }),
    prisma.leaveRequest.findMany({
      where: { tenantId, status: "approved", fromDate: { lte: day }, toDate: { gte: day } },
    }),
    prisma.bellSlot.findMany({ where: { tenantId } }),
  ]);
  const leaveUsers = new Set(leaves.map((l) => l.userId));
  const away = new Set([
    ...marks.map((m) => m.staffId),
    ...teachers.filter((t) => t.userId && leaveUsers.has(t.userId)).map((t) => t.id),
  ]);
  const name = new Map(teachers.map((t) => [t.id, t.name]));
  const bell = new Map(bells.map((b) => [b.slot, b.label]));
  /** Teachers who are here and neither teach nor already cover in that period. */
  const free = (slot: number) => {
    const busy = new Set([
      ...periods.filter((p) => p.slot === slot).map((p) => p.staffId),
      ...covers.filter((c) => c.slot === slot).map((c) => c.coverStaffId),
    ]);
    return teachers.filter((t) => !away.has(t.id) && !busy.has(t.id));
  };
  const needs = periods
    .filter((p) => p.staffId && away.has(p.staffId))
    .map((p) => {
      const cover = covers.find((c) => c.sectionId === p.sectionId && c.slot === p.slot);
      return {
        sectionId: p.sectionId,
        slot: p.slot,
        period: bell.get(p.slot) ?? `Period ${p.slot}`,
        classLabel: `${p.section.class.name} ${p.section.name}`,
        subject: p.subject.name,
        absentStaffId: p.staffId!,
        absent: name.get(p.staffId!) ?? "Teacher",
        coverId: cover?.id ?? null,
        cover: cover ? (name.get(cover.coverStaffId) ?? "") : "",
        free: free(p.slot).map((t) => ({ id: t.id, name: t.name })),
      };
    });
  const periodName = (slot: number) => bell.get(slot) ?? `Period ${slot}`;
  const gone = [...away].flatMap((id) => name.get(id) ?? []);
  return { date, away: gone, needs, covers, periods, periodName };
}
