import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, dayStr } from "@/server/extras";
import { handle } from "@/server/http";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** The standard reports, built from live records: enrolment, attendance, fees and teacher load. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...ADMIN]);

  const [classes, students, att, invoices, periods] = await Promise.all([
    prisma.classLevel.findMany({
      where: { tenantId },
      orderBy: { position: "asc" },
      include: { sections: { select: { id: true } } },
    }),
    prisma.student.findMany({
      where: { tenantId, status: "active" },
      select: { sectionId: true },
    }),
    prisma.attendance.findMany({
      where: { tenantId },
      select: { date: true, status: true },
      orderBy: { date: "desc" },
      take: 20000,
    }),
    prisma.invoice.findMany({
      where: { tenantId },
      select: { title: true, amountPaise: true, payments: { select: { amountPaise: true } } },
    }),
    prisma.period.findMany({
      where: { tenantId, staffId: { not: null } },
      select: { staff: { select: { name: true } } },
    }),
  ]);

  const perSection = new Map<string, number>();
  for (const s of students)
    if (s.sectionId) perSection.set(s.sectionId, (perSection.get(s.sectionId) ?? 0) + 1);
  const enrolment = classes
    .map((c) => ({
      label: c.name,
      count: c.sections.reduce((n, s) => n + (perSection.get(s.id) ?? 0), 0),
    }))
    .filter((c) => c.count > 0);

  const byDay = new Map<string, { present: number; total: number }>();
  for (const a of att) {
    const k = dayStr(a.date);
    const d = byDay.get(k) ?? { present: 0, total: 0 };
    d.total += 1;
    if (a.status === "present" || a.status === "late") d.present += 1;
    byDay.set(k, d);
  }
  const attendance = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 7)
    .reverse()
    .map(([date, d]) => ({ label: date, pct: pct(d.present, d.total) }));

  const byTitle = new Map<string, { billed: number; paid: number }>();
  for (const i of invoices) {
    const t = byTitle.get(i.title) ?? { billed: 0, paid: 0 };
    t.billed += i.amountPaise;
    t.paid += i.payments.reduce((n, p) => n + p.amountPaise, 0);
    byTitle.set(i.title, t);
  }
  const fees = [...byTitle.entries()].map(([label, t]) => ({
    label,
    pct: Math.min(100, pct(t.paid, t.billed)),
  }));

  const load = new Map<string, number>();
  for (const p of periods) {
    const n = p.staff?.name ?? "";
    if (n) load.set(n, (load.get(n) ?? 0) + 1);
  }
  const max = Math.max(1, ...load.values());
  const workload = [...load.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([label, n]) => ({ label, pct: Math.round((n / max) * 100), count: n }));

  return NextResponse.json({ enrolment, attendance, fees, workload });
});
