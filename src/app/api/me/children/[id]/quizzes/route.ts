import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { labelsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";
import { questionsOf, totalOf } from "@/server/quizzes";

/** Tests of the child's class: open ones, and any already taken. No questions or answers here. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  if (!child.sectionId) return NextResponse.json([]);
  const [quizzes, attempts, label] = await Promise.all([
    prisma.quiz.findMany({
      where: { tenantId, sectionId: child.sectionId, status: { not: "draft" } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.quizAttempt.findMany({ where: { tenantId, studentId: child.id } }),
    labelsFor(tenantId),
  ]);
  const mine = new Map(attempts.map((a) => [a.quizId, a]));
  return NextResponse.json(
    quizzes.flatMap((q) => {
      const a = mine.get(q.id);
      if (q.status === "closed" && !a) return [];
      const questions = questionsOf(q.questions);
      return {
        id: q.id,
        title: q.title,
        subject: label(q.sectionId, q.subjectId).subject,
        durationMin: q.durationMin,
        questions: questions.length,
        total: totalOf(questions),
        open: q.status === "open",
        done: !!a?.submittedAt,
        score: a?.submittedAt ? a.score : null,
      };
    }),
  );
});
