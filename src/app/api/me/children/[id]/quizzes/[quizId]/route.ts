import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { childFor } from "@/server/portal";
import { GRACE_MS, questionsOf, scoreOf, totalOf } from "@/server/quizzes";

type Ctx = { params: Promise<{ id: string; quizId: string }> };

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("submit"), answers: z.array(z.number().int().min(-1)).max(50) }),
]);

/**
 * A student takes a test: "start" hands out the questions without the answers and starts the
 * clock; "submit" marks it on the server. One attempt each.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["student"]);
  const { id, quizId } = await ctx.params;
  const child = await childFor(tenantId, user, id);
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, tenantId, sectionId: child.sectionId ?? "none", status: "open" },
  });
  if (!quiz) throw new HttpError(404, "not_found", "This test is not open.");
  const b = Body.parse(await req.json());
  const questions = questionsOf(quiz.questions);
  const key = { quizId_studentId: { quizId: quiz.id, studentId: child.id } };
  const old = await prisma.quizAttempt.findUnique({ where: key });
  if (old?.submittedAt) throw new HttpError(409, "done", "You have already taken this test.");

  if (b.action === "start") {
    const attempt =
      old ??
      (await prisma.quizAttempt.create({
        data: { tenantId, quizId: quiz.id, studentId: child.id, total: totalOf(questions) },
      }));
    return NextResponse.json({
      endsAt: new Date(attempt.startedAt.getTime() + quiz.durationMin * 60_000).toISOString(),
      questions: questions.map((q) => ({ text: q.text, options: q.options, marks: q.marks })),
    });
  }
  if (!old) throw new HttpError(409, "not_started", "Start the test first.");
  if (Date.now() > old.startedAt.getTime() + quiz.durationMin * 60_000 + GRACE_MS)
    throw new HttpError(409, "time_up", "The time for this test is over.");
  const score = scoreOf(questions, b.answers);
  // Only an attempt that is still open may be marked, so a double send counts once.
  const { count } = await prisma.quizAttempt.updateMany({
    where: { id: old.id, submittedAt: null },
    data: { answers: JSON.stringify(b.answers), score, submittedAt: new Date() },
  });
  if (!count) throw new HttpError(409, "done", "You have already taken this test.");
  return NextResponse.json({ ok: true, score, total: old.total, message: "Test submitted." });
});
