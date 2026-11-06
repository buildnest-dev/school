import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { daySlots, staffOf } from "@/server/portal";

/**
 * GET: the classes the signed-in teacher teaches (from the timetable) and the ones they are class
 * teacher of. `id` is the section id, which every attendance, marks and homework call uses.
 */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const me = await staffOf(tenantId, user.id);
  if (!me) return NextResponse.json([]);
  const [periods, mine, today] = await Promise.all([
    prisma.period.findMany({
      where: { tenantId, staffId: me.id },
      include: { subject: true, section: { include: { class: true } } },
      orderBy: [{ day: "asc" }, { slot: "asc" }],
    }),
    prisma.section.findMany({
      where: { tenantId, classTeacherId: me.id },
      include: { class: true },
    }),
    daySlots(tenantId, { staffId: me.id }),
  ]);
  const bySection = new Map<
    string,
    { label: string; subject: string; subjectId: string | null; room: string }
  >();
  for (const p of periods)
    if (!bySection.has(p.sectionId))
      bySection.set(p.sectionId, {
        label: `${p.section.class.name} ${p.section.name}`,
        subject: p.subject.name,
        subjectId: p.subjectId,
        room: p.room ?? "",
      });
  for (const s of mine)
    if (!bySection.has(s.id))
      bySection.set(s.id, {
        label: `${s.class.name} ${s.name}`,
        subject: "Class teacher",
        subjectId: null,
        room: "",
      });
  const counts = await prisma.student.groupBy({
    by: ["sectionId"],
    where: { tenantId, status: "active", sectionId: { in: [...bySection.keys()] } },
    _count: true,
  });
  const n = new Map(counts.map((c) => [c.sectionId, c._count]));
  const items = [...bySection.entries()].map(([id, c]) => {
    const t = today.find((x) => x.sectionId === id);
    return {
      id,
      label: c.label,
      subject: c.subject,
      subjectId: c.subjectId,
      period: t?.period ?? "Not today",
      time: t?.time ?? "",
      room: t?.room || c.room,
      studentCount: n.get(id) ?? 0,
    };
  });
  return NextResponse.json(items);
});
