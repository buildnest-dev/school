import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { sectionResults } from "@/server/reportcards";

/**
 * One student's report card(s). Staff see every exam (with a `published` flag); a parent sees only
 * published exams of their own linked child, and a missing child or unpublished exam is a 404.
 */
export const GET = handle(async (req: Request, ctx: { params: Promise<{ studentId: string }> }) => {
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "teacher",
    "parent",
  ]);
  const { studentId } = await ctx.params;
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId },
    include: { guardian: true, section: { include: { class: true } } },
  });
  if (!student || !student.sectionId) throw new HttpError(404, "not_found", "Student not found.");
  const isParent = user.role === "parent";
  if (isParent && student.guardian?.userId !== user.id)
    throw new HttpError(404, "not_found", "Student not found.");

  const examId = new URL(req.url).searchParams.get("examId");
  const exams = await prisma.exam.findMany({
    where: {
      tenantId,
      ...(examId ? { id: examId } : {}),
      ...(isParent ? { published: true } : {}),
    },
    orderBy: { name: "asc" },
  });
  if (examId && exams.length === 0) throw new HttpError(404, "not_found", "Report card not found.");

  const cards = [];
  for (const e of exams) {
    const r = await sectionResults(tenantId, e.id, student.sectionId);
    const mine = r?.cards.find((c) => c.studentId === studentId);
    if (!r || !mine) continue;
    cards.push({
      exam: r.exam,
      board: r.boardCode,
      scale: r.scale,
      subjects: mine.result.subjects,
      total: mine.result.total,
      maxTotal: mine.result.maxTotal,
      percent: mine.result.percent,
      grade: mine.result.grade,
      remark: mine.result.remark,
      result: mine.result.result,
      rank: mine.rank,
      classStrength: r.cards.length,
    });
  }
  return NextResponse.json({
    student: {
      id: student.id,
      name: student.name,
      admissionNo: student.admissionNo,
      classSection: `${student.section!.class.name} ${student.section!.name}`,
    },
    cards,
  });
});
