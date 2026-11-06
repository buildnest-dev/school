import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { like, prisma, tenantDb } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { sectionOr404 } from "@/server/lib";
import {
  assertRoomForStudents,
  checkLocation,
  nextAdmissionNo,
  studentDetail,
  studentInclude,
} from "@/server/students";
import { guardianInput, studentFields } from "@/server/validators";
import type { Student } from "@/types";

const STAFF_ROLES = [
  "school_owner",
  "principal",
  "vice_principal",
  "admission_officer",
  "teacher",
  "accountant",
] as const;

const CreateBody = studentFields.extend({
  guardian: guardianInput,
  /** Set true after the user has seen the "possible duplicate" warning and still wants to add. */
  confirmDuplicate: z.boolean().optional(),
});

/** POST /api/students: direct admission by the office (the admissions pipeline uses its own admit endpoint). */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const b = CreateBody.parse(await req.json());
  await sectionOr404(tenantId, b.sectionId);
  await assertRoomForStudents(tenantId);
  await checkLocation(b.stateId, b.districtId);

  const dup = await prisma.student.findFirst({
    where: { tenantId, name: b.name, dob: new Date(b.dob), status: "active" },
  });
  if (dup && !b.confirmDuplicate)
    throw new HttpError(
      409,
      "possible_duplicate",
      `A student named ${b.name} with this date of birth already exists (${dup.admissionNo}).`,
    );

  const { guardian, confirmDuplicate: _c, ...f } = b;
  void _c;
  const created = await prisma.$transaction(async (tx) => {
    const g = await tx.guardian.create({ data: { tenantId, ...guardian } });
    const s = await tx.student.create({
      data: {
        ...f,
        dob: new Date(f.dob),
        tenantId,
        admissionNo: await nextAdmissionNo(tx, tenantId),
        guardianId: g.id,
      },
      include: studentInclude,
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "student.create",
        entity: "student",
        entityId: s.id,
      },
    });
    return s;
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: created.id, student: studentDetail(created) },
    { status: 201 },
  );
});

/** GET /api/students?q=&page=&pageSize=&sort=&order=&filter[status]= — tenant comes from the session only. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...STAFF_ROLES]);
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 10) || 10));
  const q = sp.get("q")?.trim();
  const status = sp.get("filter[status]");

  const where = {
    ...(q ? { OR: [{ name: like(q) }, { admissionNo: like(q) }] } : {}),
    ...(status ? { status } : {}),
  };
  const db = tenantDb(tenantId);
  const [rows, total] = await Promise.all([
    db.students.list(where, { skip: (page - 1) * pageSize, take: pageSize }),
    db.students.count(where),
  ]);

  const ids = rows.map((r) => r.id);
  const [paid, due, att] = await Promise.all([
    prisma.payment.groupBy({
      by: ["invoiceId"],
      where: { tenantId, invoice: { studentId: { in: ids } } },
      _sum: { amountPaise: true },
    }),
    prisma.invoice.findMany({ where: { tenantId, studentId: { in: ids } } }),
    prisma.attendance.groupBy({
      by: ["studentId", "status"],
      where: { tenantId, studentId: { in: ids } },
      _count: true,
    }),
  ]);
  const paidBy = new Map(paid.map((p) => [p.invoiceId, p._sum.amountPaise ?? 0]));
  const now = new Date();

  const items: Student[] = rows.map((r, i) => {
    const inv = due.filter((d) => d.studentId === r.id);
    const owed = inv.reduce((s, d) => s + d.amountPaise, 0);
    const got = inv.reduce((s, d) => s + (paidBy.get(d.id) ?? 0), 0);
    const overdue = inv.some((d) => d.dueOn < now && (paidBy.get(d.id) ?? 0) < d.amountPaise);
    const mine = att.filter((a) => a.studentId === r.id);
    const all = mine.reduce((s, a) => s + a._count, 0);
    const present = mine
      .filter((a) => a.status === "present" || a.status === "late")
      .reduce((s, a) => s + a._count, 0);
    return {
      id: r.id,
      admissionNo: r.admissionNo,
      name: r.name,
      classSection: r.section ? `${r.section.class.name} ${r.section.name}` : "Unassigned",
      rollNo: (page - 1) * pageSize + i + 1,
      guardian: r.guardian?.name ?? "",
      phone: r.guardian?.phone ?? "",
      status:
        r.status === "active" ? "active" : r.status === "transferred" ? "transferred" : "withdrawn",
      feeStatus: got >= owed ? "paid" : overdue ? "overdue" : "partial",
      attendancePct: all ? Math.round((present / all) * 100) : 0,
    };
  });
  return NextResponse.json({ items, total, page, pageSize });
});
