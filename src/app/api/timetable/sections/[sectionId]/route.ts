import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { sectionLabel, sectionOr404 } from "@/server/lib";
import { activeTeacherOr422 } from "@/server/staff";
import { bellSchedule, DAY_NAMES, periodInclude, periodView } from "@/server/timetable";

type Ctx = { params: Promise<{ sectionId: string }> };

/**
 * Weekly timetable of one class. Staff can read any class; a parent only the class one of their
 * own children is in.
 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "teacher",
    "accountant",
    "parent",
  ]);
  const section = await sectionOr404(tenantId, (await ctx.params).sectionId);
  if (user.role === "parent") {
    const own = await prisma.student.findFirst({
      where: { tenantId, sectionId: section.id, status: "active", guardian: { userId: user.id } },
      select: { id: true },
    });
    if (!own) throw new HttpError(404, "not_found", "Class not found.");
  }
  const [bell, periods] = await Promise.all([
    bellSchedule(tenantId),
    prisma.period.findMany({
      where: { tenantId, sectionId: section.id },
      include: periodInclude,
      orderBy: [{ day: "asc" }, { slot: "asc" }],
    }),
  ]);
  return NextResponse.json({
    sectionId: section.id,
    classSection: sectionLabel(section),
    bell,
    periods: periods.map(periodView),
  });
});

const Body = z.object({
  periods: z
    .array(
      z.object({
        day: z.number().int().min(1).max(7),
        slot: z.number().int().min(1).max(12),
        subjectId: z.string().min(1),
        staffId: z.string().min(1).nullable().optional(),
        room: z.string().trim().max(20).optional(),
      }),
    )
    .max(84),
});

/**
 * Replaces the whole week of one class in one transaction. Refused (nothing saved) when a slot
 * is a break or does not exist, a subject is not taught in this class, a teacher is not an
 * active teacher of this school, or a teacher would be in two classes at the same time.
 */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const section = await sectionOr404(tenantId, (await ctx.params).sectionId);
  const { periods } = Body.parse(await req.json());

  const [bell, subjects] = await Promise.all([
    bellSchedule(tenantId),
    prisma.subject.findMany({ where: { tenantId, classId: section.classId } }),
  ]);
  const slotInfo = new Map(bell.map((b) => [b.slot, b]));
  const subjectIds = new Set(subjects.map((s) => s.id));

  const seen = new Set<string>();
  const teacherAt = new Map<string, string>();
  for (const p of periods) {
    const where = `${DAY_NAMES[p.day - 1]} slot ${p.slot}`;
    const info = slotInfo.get(p.slot);
    if (!info)
      throw new HttpError(422, "bad_slot", `${where}: this slot is not in the bell schedule.`);
    if (info.isBreak) throw new HttpError(422, "break_slot", `${where} is a break.`);
    if (!subjectIds.has(p.subjectId))
      throw new HttpError(
        422,
        "bad_subject",
        `${where}: this subject is not taught in this class.`,
      );
    const key = `${p.day}|${p.slot}`;
    if (seen.has(key)) throw new HttpError(422, "duplicate", `${where} is listed twice.`);
    seen.add(key);
    if (p.staffId) {
      if (teacherAt.has(`${p.staffId}|${key}`))
        throw new HttpError(422, "teacher_clash", `${where}: the same teacher is listed twice.`);
      teacherAt.set(`${p.staffId}|${key}`, key);
    }
  }
  // Check every distinct teacher once, then look for clashes with other classes.
  const staffIds = [...new Set(periods.flatMap((p) => (p.staffId ? [p.staffId] : [])))];
  for (const id of staffIds) await activeTeacherOr422(tenantId, id);
  if (staffIds.length) {
    const busy = await prisma.period.findMany({
      where: { tenantId, staffId: { in: staffIds }, sectionId: { not: section.id } },
      include: periodInclude,
    });
    for (const b of busy) {
      if (b.staffId && teacherAt.has(`${b.staffId}|${b.day}|${b.slot}`))
        throw new HttpError(
          409,
          "teacher_busy",
          `${b.staff?.name} already teaches ${b.section.class.name} ${b.section.name} on ${DAY_NAMES[b.day - 1]} slot ${b.slot}.`,
        );
    }
  }

  try {
    await prisma.$transaction([
      prisma.period.deleteMany({ where: { tenantId, sectionId: section.id } }),
      prisma.period.createMany({
        data: periods.map((p) => ({
          tenantId,
          sectionId: section.id,
          day: p.day,
          slot: p.slot,
          subjectId: p.subjectId,
          staffId: p.staffId ?? null,
          room: p.room || null,
        })),
      }),
      prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "timetable.save",
          entity: "section",
          entityId: section.id,
        },
      }),
    ]);
  } catch (e) {
    // A concurrent save booked the same teacher or slot between our check and the write.
    if ((e as { code?: string }).code === "P2002")
      throw new HttpError(409, "teacher_busy", "The timetable changed while saving; please retry.");
    throw e;
  }
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Timetable saved.",
    count: periods.length,
  });
});
