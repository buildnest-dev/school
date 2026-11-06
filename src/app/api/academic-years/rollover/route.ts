import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayField, toDay } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  label: z.string().regex(/^\d{4}-\d{2}$/, "Use the format 2027-28"),
  startsOn: dayField,
  endsOn: dayField,
  /** Students who repeat the year: they stay in their current class. */
  holdBack: z.array(z.string().min(1)).max(500).default([]),
  /** true = only show what would happen; nothing is changed. */
  preview: z.boolean().default(false),
});

/**
 * Starts a new academic year and promotes every active student to the next class (same section
 * letter; the section is created if missing). Students of the last class become alumni, and
 * students listed in holdBack stay where they are. Everything happens in one transaction, and
 * `preview: true` shows the result without changing anything.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const b = Body.parse(await req.json());

  const [first, second] = [Number(b.label.slice(0, 4)), Number(b.label.slice(5))];
  if ((first + 1) % 100 !== second)
    throw new HttpError(422, "bad_label", "The label must be two consecutive years, like 2027-28.");
  if (b.endsOn <= b.startsOn)
    throw new HttpError(422, "bad_dates", "The year must end after it starts.");
  if (await prisma.academicYear.findFirst({ where: { tenantId, label: b.label } }))
    throw new HttpError(409, "exists", `The year ${b.label} already exists.`);
  const current = await prisma.academicYear.findFirst({ where: { tenantId, current: true } });
  if (current && b.startsOn <= current.startsOn.toISOString().slice(0, 10))
    throw new HttpError(422, "bad_dates", "The new year must start after the current one.");

  const [classes, students] = await Promise.all([
    prisma.classLevel.findMany({ where: { tenantId }, orderBy: { position: "asc" } }),
    prisma.student.findMany({
      where: { tenantId, status: "active", sectionId: { not: null } },
      include: { section: true },
    }),
  ]);
  const held = new Set(b.holdBack);
  const known = new Set(students.map((s) => s.id));
  if ([...held].some((id) => !known.has(id)))
    throw new HttpError(
      422,
      "bad_student",
      "holdBack contains a student who is not an active student.",
    );

  const nextOf = new Map(classes.map((c, i) => [c.id, classes[i + 1] ?? null]));
  const moves = new Map<string, { classId: string; sectionName: string; ids: string[] }>();
  const graduates: string[] = [];
  const stay: string[] = [];
  for (const s of students) {
    if (held.has(s.id)) {
      stay.push(s.id);
      continue;
    }
    const next = nextOf.get(s.section!.classId) ?? null;
    if (!next) {
      graduates.push(s.id);
      continue;
    }
    const key = `${next.id}|${s.section!.name}`;
    const m = moves.get(key) ?? { classId: next.id, sectionName: s.section!.name, ids: [] };
    m.ids.push(s.id);
    moves.set(key, m);
  }

  const className = new Map(classes.map((c) => [c.id, c.name]));
  const summary = {
    label: b.label,
    promoted: [...moves.values()].reduce((n, m) => n + m.ids.length, 0),
    graduating: graduates.length,
    heldBack: stay.length,
    byClass: [...moves.values()].map((m) => ({
      to: `${className.get(m.classId)} ${m.sectionName}`,
      students: m.ids.length,
    })),
  };
  if (b.preview) return NextResponse.json({ ok: true, mode: "api", preview: true, ...summary });

  await prisma.$transaction(async (tx) => {
    for (const m of moves.values()) {
      const section =
        (await tx.section.findFirst({ where: { classId: m.classId, name: m.sectionName } })) ??
        (await tx.section.create({
          data: { tenantId, classId: m.classId, name: m.sectionName },
        }));
      await tx.student.updateMany({
        where: { tenantId, id: { in: m.ids } },
        data: { sectionId: section.id },
      });
    }
    if (graduates.length)
      await tx.student.updateMany({
        where: { tenantId, id: { in: graduates } },
        data: { status: "alumni" },
      });
    await tx.academicYear.updateMany({ where: { tenantId }, data: { current: false } });
    await tx.academicYear.create({
      data: {
        tenantId,
        label: b.label,
        startsOn: toDay(b.startsOn),
        endsOn: toDay(b.endsOn),
        current: true,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "year.rollover",
        entity: "tenant",
        entityId: tenantId,
      },
    });
  });
  return NextResponse.json({ ok: true, mode: "api", preview: false, ...summary }, { status: 201 });
});
