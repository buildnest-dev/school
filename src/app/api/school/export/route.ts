import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

const day = (d: Date | null) => d?.toISOString().slice(0, 10) ?? null;

/**
 * GET: a full export of the school's records as JSON. It stays available when the subscription
 * has lapsed, so a school can always take its data with it. Aadhaar is never stored in full.
 */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const [students, staff, classes, invoices, exams, marks] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId },
      include: { guardian: true, section: { include: { class: true } } },
      orderBy: { admissionNo: "asc" },
    }),
    prisma.staff.findMany({ where: { tenantId }, orderBy: { employeeNo: "asc" } }),
    prisma.classLevel.findMany({ where: { tenantId }, include: { sections: true } }),
    prisma.invoice.findMany({ where: { tenantId }, include: { payments: true } }),
    prisma.exam.findMany({ where: { tenantId } }),
    prisma.mark.findMany({ where: { tenantId } }),
  ]);
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "school.export",
      entity: "tenant",
      entityId: tenantId,
    },
  });
  return NextResponse.json({
    format: "zaqsa-export-v1",
    exportedAt: new Date().toISOString(),
    classes: classes.map((c) => ({ name: c.name, sections: c.sections.map((s) => s.name) })),
    students: students.map((s) => ({
      admissionNo: s.admissionNo,
      name: s.name,
      dob: day(s.dob),
      gender: s.gender,
      status: s.status,
      classSection: s.section ? `${s.section.class.name} ${s.section.name}` : null,
      aadhaarLast4: s.aadhaarLast4,
      guardian: s.guardian
        ? {
            name: s.guardian.name,
            relation: s.guardian.relation,
            phone: s.guardian.phone,
            email: s.guardian.email,
          }
        : null,
    })),
    staff: staff.map((s) => ({
      employeeNo: s.employeeNo,
      name: s.name,
      role: s.role,
      status: s.status,
    })),
    invoices: invoices.map((i) => ({
      number: i.number,
      title: i.title,
      amount: i.amountPaise / 100,
      dueOn: day(i.dueOn),
      payments: i.payments.map((p) => ({
        amount: p.amountPaise / 100,
        mode: p.mode,
        reference: p.reference,
      })),
    })),
    exams: exams.map((e) => ({
      id: e.id,
      name: e.name,
      maxMarks: e.maxMarks,
      published: e.published,
    })),
    marks: marks.map((m) => ({
      examId: m.examId,
      studentId: m.studentId,
      subjectId: m.subjectId,
      score: m.score,
    })),
  });
});
