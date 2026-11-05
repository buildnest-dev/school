import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { sectionResults } from "@/server/reportcards";

/** Class result sheet for one exam: every student's total, percentage, grade, result and rank. Staff only. */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ sectionId: string }> }) => {
  const { tenantId } = await requireTenant(["school_owner", "principal", "teacher"]);
  const { sectionId } = await ctx.params;
  const examId =
    new URL(req.url).searchParams.get("examId") ??
    (await prisma.exam.findFirst({ where: { tenantId }, orderBy: { name: "asc" } }))?.id;
  if (!examId) throw new HttpError(404, "not_found", "No exam found.");
  const r = await sectionResults(tenantId, examId, sectionId);
  if (!r) throw new HttpError(404, "not_found", "Exam or class not found.");

  const done = r.cards.filter((c) => c.result.result !== "incomplete");
  const passed = done.filter((c) => c.result.result === "pass").length;
  const average = done.length
    ? Math.round(done.reduce((s, c) => s + (c.result.percent ?? 0), 0) / done.length)
    : null;
  return NextResponse.json({
    exam: r.exam,
    board: r.boardCode,
    classLabel: r.classLabel,
    summary: {
      students: r.cards.length,
      complete: done.length,
      passed,
      failed: done.length - passed,
      averagePercent: average,
    },
    rows: r.cards.map((c) => ({
      studentId: c.studentId,
      rollNo: c.rollNo,
      name: c.name,
      total: c.result.total,
      maxTotal: c.result.maxTotal,
      percent: c.result.percent,
      grade: c.result.grade,
      result: c.result.result,
      rank: c.rank,
    })),
  });
});
