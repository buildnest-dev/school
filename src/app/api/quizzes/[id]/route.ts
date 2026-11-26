import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { CLASS_STAFF } from "@/server/classwork";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

async function ownQuiz(ctx: Ctx) {
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const quiz = await prisma.quiz.findFirst({
    where: {
      id: (await ctx.params).id,
      tenantId,
      ...(user.role === "teacher" ? { createdById: user.id } : {}),
    },
  });
  if (!quiz) throw new HttpError(404, "not_found", "Test not found.");
  return { tenantId, quiz };
}

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { quiz } = await ownQuiz(ctx);
  const { status } = z.object({ status: z.enum(["open", "closed"]) }).parse(await req.json());
  await prisma.quiz.update({ where: { id: quiz.id }, data: { status } });
  return NextResponse.json({
    ok: true,
    message: status === "open" ? "The class can take the test now." : "Test closed.",
  });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, quiz } = await ownQuiz(ctx);
  if (await prisma.quizAttempt.count({ where: { tenantId, quizId: quiz.id } }))
    throw new HttpError(409, "in_use", "Students have taken this test. Close it instead.");
  await prisma.quiz.delete({ where: { id: quiz.id } });
  return NextResponse.json({ ok: true, message: "Test removed." });
});
