import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { CLASS_STAFF, labelsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { notifyUsers } from "@/server/push";
import { assertCanAssign } from "@/server/teaching";

/** Answers waiting for the teacher: their own homework (managers see all). */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const homework = await prisma.homework.findMany({
    where: { tenantId, ...(user.role === "teacher" ? { createdById: user.id } : {}) },
    orderBy: { dueOn: "desc" },
    take: 100,
  });
  const rows = await prisma.homeworkSubmission.findMany({
    where: { tenantId, homeworkId: { in: homework.map((h) => h.id) } },
    orderBy: { submittedAt: "desc" },
    take: 300,
  });
  const students = await prisma.student.findMany({
    where: { tenantId, id: { in: rows.map((r) => r.studentId) } },
    select: { id: true, name: true },
  });
  const name = new Map(students.map((s) => [s.id, s.name]));
  const hw = new Map(homework.map((h) => [h.id, h]));
  const label = await labelsFor(tenantId);
  return NextResponse.json(
    rows.map((r) => {
      const h = hw.get(r.homeworkId)!;
      return {
        id: r.id,
        student: name.get(r.studentId) ?? "Student",
        homework: h.title,
        ...label(h.sectionId, h.subjectId),
        text: r.text,
        link: r.link,
        submittedOn: dayStr(r.submittedAt),
        grade: r.grade,
        feedback: r.feedback,
        checked: !!r.checkedAt,
      };
    }),
  );
});

const Body = z.object({
  id: z.string().min(1),
  grade: z.string().trim().max(20).default(""),
  feedback: z.string().trim().max(2000).default(""),
});

export const PATCH = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const b = Body.parse(await req.json());
  const row = await prisma.homeworkSubmission.findFirst({ where: { id: b.id, tenantId } });
  const hw = row && (await prisma.homework.findFirst({ where: { id: row.homeworkId, tenantId } }));
  if (!row || !hw) throw new HttpError(404, "not_found", "Answer not found.");
  await assertCanAssign(tenantId, user, hw.sectionId, hw.subjectId);
  await prisma.homeworkSubmission.update({
    where: { id: row.id },
    data: { grade: b.grade, feedback: b.feedback, checkedAt: new Date() },
  });
  const student = await prisma.student.findFirst({
    where: { id: row.studentId, tenantId },
    select: { userId: true, guardian: { select: { userId: true } } },
  });
  for (const [userId, url] of [
    [student?.userId, "/student/answers"],
    [student?.guardian?.userId, "/parent/answers"],
  ] as const)
    if (userId)
      await notifyUsers(tenantId, [userId], {
        title: "Homework checked",
        body: hw.title.slice(0, 140),
        url,
      });
  return NextResponse.json({ ok: true, message: "Feedback sent." });
});
