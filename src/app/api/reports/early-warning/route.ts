import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

const DAYS = 60;

/**
 * Students who may need help: low attendance in the last 60 days (at least five marked days) or
 * a low average in published exams. A prompt for a person to look, not a judgement.
 */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant(["school_owner", "principal", "vice_principal"]);
  const since = new Date(Date.now() - DAYS * 86_400_000);
  const students = await prisma.student.findMany({
    where: { tenantId, status: "active" },
    include: { section: { include: { class: true } } },
  });
  const [attendance, marks] = await Promise.all([
    prisma.attendance.findMany({
      where: { tenantId, date: { gte: since } },
      select: { studentId: true, status: true },
    }),
    prisma.mark.findMany({
      where: { tenantId, score: { not: null }, exam: { published: true } },
      select: { studentId: true, score: true, exam: { select: { maxMarks: true } } },
    }),
  ]);
  const att = new Map<string, { here: number; total: number }>();
  for (const a of attendance) {
    const x = att.get(a.studentId) ?? { here: 0, total: 0 };
    x.total++;
    if (a.status === "present" || a.status === "late") x.here++;
    att.set(a.studentId, x);
  }
  const score = new Map<string, number[]>();
  for (const m of marks)
    score.set(m.studentId, [...(score.get(m.studentId) ?? []), (m.score! / m.exam.maxMarks) * 100]);
  const rows = students.flatMap((s) => {
    const a = att.get(s.id);
    const attendancePct = a && a.total >= 5 ? Math.round((a.here / a.total) * 100) : null;
    const m = score.get(s.id);
    const averagePct = m ? Math.round(m.reduce((x, y) => x + y, 0) / m.length) : null;
    const reasons = [
      attendancePct !== null && attendancePct < 75 ? "Low attendance" : "",
      averagePct !== null && averagePct < 40 ? "Low marks" : "",
    ].filter(Boolean);
    if (!reasons.length) return [];
    return {
      id: s.id,
      name: s.name,
      classLabel: s.section ? `${s.section.class.name} ${s.section.name}` : "",
      attendancePct,
      averagePct,
      reasons,
    };
  });
  return NextResponse.json(rows);
});
