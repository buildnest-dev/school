import { effectiveScale } from "./boards";
import { prisma } from "./db";
import { computeResult, rankBy, type ExamResult, type GradeBand } from "./grading";

export interface StudentCard {
  studentId: string;
  name: string;
  admissionNo: string;
  rollNo: number;
  result: ExamResult;
  /** Rank within the section; only for students whose result is complete. */
  rank: number | null;
}

export interface SectionResults {
  exam: { id: string; name: string; maxMarks: number; passPercent: number; published: boolean };
  boardCode: string;
  scale: GradeBand[];
  classLabel: string;
  cards: StudentCard[];
}

/**
 * Results for every active student of a section in one exam. Only marks from SUBMITTED mark
 * sheets count; draft marks are treated as not yet entered, so a card can never show numbers a
 * teacher has not signed off.
 */
export async function sectionResults(
  tenantId: string,
  examId: string,
  sectionId: string,
): Promise<SectionResults | null> {
  const [exam, section] = await Promise.all([
    prisma.exam.findFirst({ where: { id: examId, tenantId } }),
    prisma.section.findFirst({ where: { id: sectionId, tenantId }, include: { class: true } }),
  ]);
  if (!exam || !section) return null;

  const [students, subjects, sheets, marks, grading] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, sectionId, status: "active" },
      orderBy: { name: "asc" },
    }),
    prisma.subject.findMany({
      where: { tenantId, classId: section.classId },
      orderBy: { name: "asc" },
    }),
    prisma.markSheet.findMany({ where: { tenantId, examId, sectionId, status: "submitted" } }),
    prisma.mark.findMany({ where: { tenantId, examId, student: { sectionId } } }),
    effectiveScale(tenantId, exam.boardId),
  ]);
  const submitted = new Set(sheets.map((s) => s.subjectId));
  const score = new Map(marks.map((m) => [`${m.studentId}|${m.subjectId}`, m.score]));

  const cards: StudentCard[] = students.map((st, i) => ({
    studentId: st.id,
    name: st.name,
    admissionNo: st.admissionNo,
    rollNo: i + 1,
    result: computeResult(
      subjects.map((sub) => ({
        subject: sub.name,
        score: submitted.has(sub.id) ? (score.get(`${st.id}|${sub.id}`) ?? null) : null,
      })),
      exam.maxMarks,
      exam.passPercent,
      grading.scale,
    ),
    rank: null,
  }));

  const complete = cards.filter((c) => c.result.result !== "incomplete");
  const ranks = rankBy(complete.map((c) => ({ id: c.studentId, total: c.result.total })));
  for (const c of cards) c.rank = ranks.get(c.studentId) ?? null;

  return {
    exam: {
      id: exam.id,
      name: exam.name,
      maxMarks: exam.maxMarks,
      passPercent: exam.passPercent,
      published: exam.published,
    },
    boardCode: grading.boardCode,
    scale: grading.scale,
    classLabel: `${section.class.name} ${section.name}`,
    cards,
  };
}
