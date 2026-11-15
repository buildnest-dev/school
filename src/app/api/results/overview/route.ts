import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN } from "@/server/extras";
import { handle } from "@/server/http";

const BANDS: [string, number][] = [
  ["90% and above", 90],
  ["75% to 89%", 75],
  ["60% to 74%", 60],
  ["40% to 59%", 40],
  ["Below 40%", 0],
];

/**
 * Results at a glance: every exam with its publication state, average and pass rate, and how the
 * marks of the latest published exam are spread. Built from the marks already entered.
 */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...ADMIN]);
  const exams = await prisma.exam.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: { marks: { select: { score: true } } },
  });
  const rows = exams.map((x) => {
    const scores = x.marks.map((m) => m.score).filter((v): v is number => v !== null);
    const pct = scores.map((v) => (x.maxMarks ? (v / x.maxMarks) * 100 : 0));
    return {
      id: x.id,
      name: x.name,
      published: x.published,
      approved: !!x.approvedAt,
      entries: scores.length,
      avgPct: pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : 0,
      passPct: pct.length ? Math.round((pct.filter((p) => p >= x.passPercent).length / pct.length) * 100) : 0,
      pctList: pct,
    };
  });
  const latest = [...rows].reverse().find((r) => r.published && r.entries > 0) ?? null;
  const spread = latest
    ? BANDS.map(([label, min], i) => {
        const upper = i === 0 ? Infinity : BANDS[i - 1]![1];
        const count = latest.pctList.filter((p) => p >= min && p < upper).length;
        return { label, count, pct: Math.round((count / latest.pctList.length) * 100) };
      })
    : [];
  return NextResponse.json({
    exams: rows.map((r) => ({
      id: r.id,
      name: r.name,
      published: r.published,
      approved: r.approved,
      entries: r.entries,
      avgPct: r.avgPct,
      passPct: r.passPct,
    })),
    spreadExam: latest?.name ?? null,
    spread,
  });
});
