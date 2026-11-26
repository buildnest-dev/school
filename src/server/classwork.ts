import { z } from "zod";
import type { SessionUser } from "@/types";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { sectionOr404 } from "./lib";
import { assertCanAssign } from "./teaching";

export const CLASS_STAFF = ["school_owner", "principal", "teacher"] as const;

/** A class and subject the signed-in person may write work for, or an error. */
export async function classSubject(
  tenantId: string,
  user: SessionUser,
  sectionId: string,
  subjectId: string,
) {
  const section = await sectionOr404(tenantId, sectionId);
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenantId, classId: section.classId },
  });
  if (!subject)
    throw new HttpError(422, "bad_subject", "This subject is not taught in this class.");
  await assertCanAssign(tenantId, user, section.id, subject.id);
  return { section, subject };
}

/** "6 A" and "English" for rows that only keep ids. */
export async function labelsFor(tenantId: string) {
  const [sections, subjects] = await Promise.all([
    prisma.section.findMany({ where: { tenantId }, include: { class: true } }),
    prisma.subject.findMany({ where: { tenantId } }),
  ]);
  const s = new Map(sections.map((x) => [x.id, `${x.class.name} ${x.name}`]));
  const j = new Map(subjects.map((x) => [x.id, x.name]));
  return (sectionId: string, subjectId: string) => ({
    classLabel: s.get(sectionId) ?? "",
    subject: j.get(subjectId) ?? "",
  });
}

export const webLink = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https:\/\/[^\s]+$/i.test(v), "Use a link that starts with https://")
  .default("");

/**
 * Mirrors assertCanAssign: the subjects in the teacher's timetable, plus every subject of a
 * class they are class teacher of.
 */
export async function writablePairs(tenantId: string, userId: string) {
  const me = await prisma.staff.findFirst({
    where: { tenantId, userId, role: "teacher", status: "active" },
  });
  if (!me) return [];
  const [periods, own, subjects] = await Promise.all([
    prisma.period.findMany({
      where: { tenantId, staffId: me.id },
      include: { subject: true, section: { include: { class: true } } },
    }),
    prisma.section.findMany({
      where: { tenantId, classTeacherId: me.id },
      include: { class: true },
    }),
    prisma.subject.findMany({ where: { tenantId } }),
  ]);
  const all = [
    ...periods.map((p) => ({ section: p.section, subject: p.subject })),
    ...own.flatMap((section) =>
      subjects
        .filter((subject) => subject.classId === section.classId)
        .map((subject) => ({ section, subject })),
    ),
  ];
  const pairs = new Map(
    all.map(({ section, subject }) => [
      `${section.id}|${subject.id}`,
      {
        sectionId: section.id,
        subjectId: subject.id,
        classLabel: `${section.class.name} ${section.name}`,
        subject: subject.name,
      },
    ]),
  );
  return [...pairs.values()].sort((a, b) =>
    `${a.classLabel} ${a.subject}`.localeCompare(`${b.classLabel} ${b.subject}`),
  );
}

/** The students a person may write to or reward: a teacher only those in their own classes. */
export async function studentsFor(tenantId: string, user: SessionUser) {
  let sectionIds: string[] | undefined;
  if (user.role === "teacher") {
    const me = await prisma.staff.findFirst({
      where: { tenantId, userId: user.id, role: "teacher", status: "active" },
    });
    const [periods, own] = me
      ? await Promise.all([
          prisma.period.findMany({
            where: { tenantId, staffId: me.id },
            select: { sectionId: true },
          }),
          prisma.section.findMany({
            where: { tenantId, classTeacherId: me.id },
            select: { id: true },
          }),
        ])
      : [[], []];
    sectionIds = [...new Set([...periods.map((p) => p.sectionId), ...own.map((s) => s.id)])];
  }
  const rows = await prisma.student.findMany({
    where: {
      tenantId,
      status: "active",
      ...(sectionIds ? { sectionId: { in: sectionIds } } : {}),
    },
    include: { section: { include: { class: true } }, guardian: { select: { userId: true } } },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    classLabel: r.section ? `${r.section.class.name} ${r.section.name}` : "",
    guardianUserId: r.guardian?.userId ?? null,
  }));
}
