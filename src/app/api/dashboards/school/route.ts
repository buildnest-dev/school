import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { paidOf } from "@/server/fees";
import { handle } from "@/server/http";
import { parseDay } from "@/server/lib";

const STAGE_LABEL: Record<string, string> = {
  "pre-primary": "Pre-primary",
  primary: "Primary",
  middle: "Middle",
  secondary: "Secondary",
  "senior-secondary": "Senior secondary",
};
const STAGE_ORDER = Object.keys(STAGE_LABEL);

const inr = (paise: number) => "₹" + new Intl.NumberFormat("en-IN").format(Math.round(paise / 100));
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

/**
 * GET: the school home screen, built from real records and shaped by the signed-in role. Money
 * and approvals are shown only to roles that may see them. Things the system does not track yet
 * (a school calendar) come back empty rather than invented.
 */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "accountant",
    "librarian",
    "transport",
    "vice_principal",
    "admission_officer",
    "hr",
    "reception",
  ]);
  const role = user.role;
  const leader = role === "school_owner" || role === "principal";
  const academic = leader || role === "vice_principal";
  const money = leader || role === "accountant";
  const today = parseDay(istToday());
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const stats: { label: string; value: string; hint?: string }[] = [];
  let attendanceByWing: { label: string; pct: number }[] = [];
  const pendingApprovals: {
    id: string;
    kind: string;
    subject: string;
    requestedBy: string;
    requestedOn: string;
    status: "pending";
  }[] = [];

  if (academic) {
    const [students, staff, marks] = await Promise.all([
      prisma.student.count({ where: { tenantId, status: "active" } }),
      prisma.staff.count({ where: { tenantId, status: "active" } }),
      prisma.attendance.findMany({
        where: { tenantId, date: today },
        select: { status: true, section: { select: { class: { select: { stage: true } } } } },
      }),
    ]);
    const present = marks.filter((m) => m.status === "present" || m.status === "late").length;
    stats.push(
      { label: "Students", value: String(students), hint: "Enrolled now" },
      { label: "Staff", value: String(staff), hint: "Active" },
      {
        label: "Attendance today",
        value: marks.length ? `${Math.round((present / marks.length) * 100)}%` : "Not marked",
        hint: marks.length
          ? `${marks.length} students marked`
          : "No class has saved attendance yet",
      },
    );
    const byStage = new Map<string, { present: number; total: number }>();
    for (const m of marks) {
      const stage = m.section.class.stage;
      const a = byStage.get(stage) ?? { present: 0, total: 0 };
      a.total++;
      if (m.status === "present" || m.status === "late") a.present++;
      byStage.set(stage, a);
    }
    attendanceByWing = [...byStage.entries()]
      .sort((x, y) => STAGE_ORDER.indexOf(x[0]) - STAGE_ORDER.indexOf(y[0]))
      .map(([stage, a]) => ({
        label: STAGE_LABEL[stage] ?? stage,
        pct: Math.round((a.present / a.total) * 100),
      }));
  }

  if (money) {
    const invoices = await prisma.invoice.findMany({
      where: { tenantId, student: { status: "active" } },
      include: { payments: true },
    });
    let outstanding = 0;
    let overdue = 0;
    let collected = 0;
    for (const i of invoices) {
      const due = i.amountPaise - paidOf(i);
      if (due > 0) {
        outstanding += due;
        if (i.dueOn < today) overdue++;
      }
      for (const p of i.payments) if (p.paidOn >= monthStart) collected += p.amountPaise;
    }
    stats.push(
      { label: "Fees outstanding", value: inr(outstanding), hint: `${overdue} invoice(s) overdue` },
      { label: "Collected this month", value: inr(collected), hint: "After refunds" },
    );
  }

  if (money) {
    const [certs, refunds] = await Promise.all([
      leader
        ? prisma.certificate.findMany({
            where: { tenantId, status: "requested" },
            include: { student: { select: { name: true } } },
            orderBy: { createdAt: "asc" },
            take: 5,
          })
        : Promise.resolve([]),
      prisma.refund.findMany({
        where: { tenantId, status: "requested" },
        orderBy: { createdAt: "asc" },
        take: 5,
      }),
    ]);
    for (const c of certs)
      pendingApprovals.push({
        id: c.id,
        kind: "Certificate",
        subject: `${c.type} · ${c.student.name}`,
        requestedBy: c.requestedByName,
        requestedOn: c.createdAt.toISOString().slice(0, 10),
        status: "pending",
      });
    for (const r of refunds)
      pendingApprovals.push({
        id: r.id,
        kind: "Refund",
        subject: `${inr(r.amountPaise)} · ${r.reason}`,
        requestedBy: "Accounts",
        requestedOn: r.createdAt.toISOString().slice(0, 10),
        status: "pending",
      });
  }

  if (role === "admission_officer" || role === "reception") {
    const [fresh, open, students] = await Promise.all([
      prisma.admission.count({ where: { tenantId, stage: "new" } }),
      prisma.admission.count({ where: { tenantId, stage: { notIn: ["enrolled", "declined"] } } }),
      prisma.student.count({ where: { tenantId, status: "active" } }),
    ]);
    stats.push(
      { label: "New enquiries", value: String(fresh), hint: "Not looked at yet" },
      { label: "Open enquiries", value: String(open), hint: "Not yet enrolled or declined" },
      { label: "Students", value: String(students), hint: "Enrolled now" },
    );
  }
  if (role === "hr") {
    const [staff, teachers, leave] = await Promise.all([
      prisma.staff.count({ where: { tenantId, status: "active" } }),
      prisma.staff.count({ where: { tenantId, status: "active", role: "teacher" } }),
      prisma.leaveRequest.count({ where: { tenantId, status: "pending" } }),
    ]);
    stats.push(
      { label: "Staff", value: String(staff), hint: "Active" },
      { label: "Teachers", value: String(teachers) },
      { label: "Leave requests", value: String(leave), hint: "Waiting for a decision" },
    );
  }
  if (role === "librarian") {
    const [books, onLoan, overdue] = await Promise.all([
      prisma.book.count({ where: { tenantId } }),
      prisma.loan.count({ where: { tenantId, returnedOn: null } }),
      prisma.loan.count({ where: { tenantId, returnedOn: null, dueOn: { lt: today } } }),
    ]);
    stats.push(
      { label: "Titles", value: String(books), hint: "In the catalogue" },
      { label: "On loan", value: String(onLoan) },
      { label: "Overdue", value: String(overdue), hint: "Not returned by the due date" },
    );
  }
  if (role === "transport") {
    const [vehicles, routes, riders] = await Promise.all([
      prisma.vehicle.count({ where: { tenantId } }),
      prisma.transportRoute.count({ where: { tenantId } }),
      prisma.studentTransport.count({ where: { tenantId } }),
    ]);
    stats.push(
      { label: "Vehicles", value: String(vehicles) },
      { label: "Routes", value: String(routes) },
      { label: "Students using transport", value: String(riders) },
    );
  }

  return NextResponse.json({ stats, attendanceByWing, pendingApprovals, upcoming: [] });
});
