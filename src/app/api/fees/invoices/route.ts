import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { nextInvoiceNo, rupees } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

const CreateBody = z.object({
  studentId: z.string().min(1),
  title: z.string().trim().min(2).max(80),
  amount: rupees,
  dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD"),
});

/** POST: raises one invoice for a student in the current academic year. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "accountant"]);
  const b = CreateBody.parse(await req.json());
  if (Number.isNaN(Date.parse(b.dueOn)))
    throw new HttpError(422, "bad_date", "That date does not exist.");
  const student = await prisma.student.findFirst({
    where: { id: b.studentId, tenantId, status: "active" },
  });
  if (!student) throw new HttpError(404, "not_found", "Active student not found.");
  const year = await prisma.academicYear.findFirst({ where: { tenantId, current: true } });
  if (!year) throw new HttpError(409, "no_year", "Set the current academic year first.");
  const inv = await prisma.$transaction(async (tx) => {
    const i = await tx.invoice.create({
      data: {
        tenantId,
        yearId: year.id,
        studentId: student.id,
        number: await nextInvoiceNo(tx, tenantId),
        title: b.title,
        amountPaise: b.amount,
        dueOn: new Date(`${b.dueOn}T00:00:00Z`),
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "invoice.create",
        entity: "invoice",
        entityId: i.id,
      },
    });
    return i;
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: inv.id, number: inv.number },
    { status: 201 },
  );
});

/** Amounts are stored in paise; the API returns rupees (the shape the frontend already uses). */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant(["school_owner", "principal", "accountant"]);
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 10) || 10));
  const q = sp.get("q")?.trim();
  const where = {
    tenantId,
    ...(q ? { OR: [{ number: { contains: q } }, { student: { name: { contains: q } } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { dueOn: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { payments: true, student: { include: { section: { include: { class: true } } } } },
    }),
    prisma.invoice.count({ where }),
  ]);
  const now = new Date();
  const items = rows.map((i) => {
    const paid = i.payments.reduce((s, p) => s + p.amountPaise, 0);
    const status =
      paid >= i.amountPaise ? "paid" : i.dueOn < now ? "overdue" : paid > 0 ? "partial" : "pending";
    return {
      id: i.id,
      number: i.number,
      studentName: i.student.name,
      classSection: i.student.section
        ? `${i.student.section.class.name} ${i.student.section.name}`
        : "",
      term: i.title,
      amount: i.amountPaise / 100,
      paid: paid / 100,
      due: i.dueOn.toISOString().slice(0, 10),
      status,
    };
  });
  return NextResponse.json({ items, total, page, pageSize });
});
