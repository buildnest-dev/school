import { CBSE_SCALE, GENERIC_SCALE, type GradeBand } from "@/data/boards";

export type { GradeBand };

/** Validates a school-edited grading scale: whole-number bands that cover 0..100 exactly once. */
export function validateScale(scale: GradeBand[]): string | null {
  if (scale.length < 2 || scale.length > 12) return "A scale needs between 2 and 12 grades.";
  const sorted = [...scale].sort((a, b) => a.from - b.from);
  const names = new Set<string>();
  for (const b of sorted) {
    if (!Number.isInteger(b.from) || !Number.isInteger(b.to))
      return "Marks limits must be whole numbers.";
    if (b.from < 0 || b.to > 100 || b.from > b.to) return `Grade ${b.name} has an invalid range.`;
    if (names.has(b.name)) return `Grade ${b.name} is listed twice.`;
    names.add(b.name);
  }
  if (sorted[0]!.from !== 0) return "The lowest grade must start at 0.";
  if (sorted[sorted.length - 1]!.to !== 100) return "The highest grade must end at 100.";
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (cur.from <= prev.to) return `${prev.name} and ${cur.name} overlap.`;
    if (cur.from !== prev.to + 1) return `There is a gap between ${prev.name} and ${cur.name}.`;
  }
  return null;
}

/** Percentage rounded to the nearest whole number (half up), which is what the grade bands use. */
export function percentOf(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((score / max) * 100);
}

export function gradeFor(percent: number, scale: GradeBand[]): GradeBand | null {
  return scale.find((b) => percent >= b.from && percent <= b.to) ?? null;
}

export function parseScale(json: string | null | undefined, fallback: GradeBand[]): GradeBand[] {
  if (!json) return fallback;
  try {
    const v = JSON.parse(json) as GradeBand[];
    return Array.isArray(v) && v.length ? v : fallback;
  } catch {
    return fallback;
  }
}

export const DEFAULT_SCALE = CBSE_SCALE;
export { GENERIC_SCALE };

export interface SubjectResult {
  subject: string;
  score: number | null;
  max: number;
  percent: number | null;
  grade: string | null;
  remark: string | null;
  passed: boolean | null;
}

export interface ExamResult {
  subjects: SubjectResult[];
  total: number;
  maxTotal: number;
  percent: number | null;
  grade: string | null;
  remark: string | null;
  /** "incomplete" until every subject has a submitted mark, so a partial card never shows PASS/FAIL. */
  result: "pass" | "fail" | "incomplete";
}

/** Computes one student's result for one exam. A subject below the pass percentage fails the exam. */
export function computeResult(
  rows: { subject: string; score: number | null }[],
  max: number,
  passPercent: number,
  scale: GradeBand[],
): ExamResult {
  const subjects: SubjectResult[] = rows.map((r) => {
    if (r.score === null) {
      return {
        subject: r.subject,
        score: null,
        max,
        percent: null,
        grade: null,
        remark: null,
        passed: null,
      };
    }
    const percent = percentOf(r.score, max);
    const g = gradeFor(percent, scale);
    return {
      subject: r.subject,
      score: r.score,
      max,
      percent,
      grade: g?.name ?? null,
      remark: g?.remark ?? null,
      passed: percent >= passPercent,
    };
  });
  const complete = subjects.length > 0 && subjects.every((s) => s.score !== null);
  const total = subjects.reduce((s, x) => s + (x.score ?? 0), 0);
  const maxTotal = subjects.length * max;
  const percent = complete ? percentOf(total, maxTotal) : null;
  const g = percent === null ? null : gradeFor(percent, scale);
  return {
    subjects,
    total,
    maxTotal,
    percent,
    grade: g?.name ?? null,
    remark: g?.remark ?? null,
    result: !complete ? "incomplete" : subjects.every((s) => s.passed) ? "pass" : "fail",
  };
}

/** Competition ranking (1,2,2,4): equal totals share a rank. Only complete results are ranked. */
export function rankBy<T extends { id: string; total: number }>(items: T[]): Map<string, number> {
  const sorted = [...items].sort((a, b) => b.total - a.total);
  const ranks = new Map<string, number>();
  sorted.forEach((it, i) => {
    const prev = sorted[i - 1];
    ranks.set(it.id, prev && prev.total === it.total ? ranks.get(prev.id)! : i + 1);
  });
  return ranks;
}
