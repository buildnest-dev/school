import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { classSubject, CLASS_STAFF, labelsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { Question, questionsOf, totalOf } from "@/server/quizzes";

/** A teacher's own tests with results; the owner and principal see all. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const quizzes = await prisma.quiz.findMany({
    where: { tenantId, ...(user.role === "teacher" ? { createdById: user.id } : {}) },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const attempts = await prisma.quizAttempt.findMany({
    where: { tenantId, quizId: { in: quizzes.map((q) => q.id) }, submittedAt: { not: null } },
  });
  const students = await prisma.student.findMany({
    where: { tenantId, id: { in: attempts.map((a) => a.studentId) } },
    select: { id: true, name: true },
  });
  const name = new Map(students.map((s) => [s.id, s.name]));
  const label = await labelsFor(tenantId);
  return NextResponse.json(
    quizzes.map((q) => {
      const questions = questionsOf(q.questions);
      return {
        id: q.id,
        title: q.title,
        ...label(q.sectionId, q.subjectId),
        status: q.status,
        durationMin: q.durationMin,
        questions: questions.length,
        total: totalOf(questions),
        results: attempts
          .filter((a) => a.quizId === q.id)
          .map((a) => ({ student: name.get(a.studentId) ?? "Student", score: a.score }))
          .sort((a, b) => b.score - a.score),
      };
    }),
  );
});

const Body = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(3).max(150),
  durationMin: z.number().int().min(1).max(180),
  questions: z.array(Question).min(1).max(50),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const b = Body.parse(await req.json());
  await classSubject(tenantId, user, b.sectionId, b.subjectId);
  const q = await prisma.quiz.create({
    data: {
      tenantId,
      ...b,
      questions: JSON.stringify(b.questions),
      createdById: user.id,
      createdByName: user.name,
    },
  });
  return NextResponse.json(
    { ok: true, id: q.id, message: "Test saved. Open it when the class is ready." },
    { status: 201 },
  );
});
