import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES, nextInvoiceNo } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD");
const Row = z.object({
  admissionNo: z.string().trim().min(1),
  title: z.string().trim().min(2).max(80),
  /** What the family owed for this item, in rupees. */
  amount: z.number().positive().max(10_000_000),
  /** What they had already paid before the school started using ZAQSA. */
  paid: z.number().min(0).max(10_000_000).default(0),
  dueOn: day,
  paidOn: day.optional(),
  mode: z.enum(["cash", "upi", "cheque", "dd", "netbanking", "card"]).default("cash"),
  reference: z.string().trim().max(60).optional(),
});
const Body = z.object({ rows: z.array(Row).min(1).max(500), commit: z.boolean().default(false) });

const paise = (r: number) => Math.round(r * 100);
const validDay = (d: string) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

/**
 * POST: the accountant enters what already happened before the school joined: dues of this year,
 * and what was already paid. With commit:false it only checks every row; with commit:true it saves
 * all of them or none. A student's item with the same title is never entered twice.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...FEE_ROLES]);
  const { rows, commit } = Body.parse(await req.json());
  const year = await prisma.academicYear.findFirst({ where: { tenantId, current: true } });
  if (!year) throw new HttpError(409, "no_year", "Set the current academic year first.");

  const students = await prisma.student.findMany({
    where: { tenantId, status: "active", admissionNo: { in: rows.map((r) => r.admissionNo) } },
    select: { id: true, admissionNo: true },
  });
  const byNo = new Map(students.map((s) => [s.admissionNo, s.id]));
  const existing = await prisma.invoice.findMany({
    where: { tenantId, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true, title: true },
  });
  const have = new Set(existing.map((e) => `${e.studentId}|${e.title.toLowerCase()}`));
  const today = new Date().toISOString().slice(0, 10);

  const errors: { line: number; message: string }[] = [];
  const seen = new Set<string>();
  rows.forEach((r, i) => {
    const line = i + 1;
    const bad = (message: string) => errors.push({ line, message });
    const sid = byNo.get(r.admissionNo);
    if (!sid) return bad(`No active student with admission number ${r.admissionNo}.`);
    const key = `${sid}|${r.title.toLowerCase()}`;
    if (have.has(key) || seen.has(key)) bad(`"${r.title}" is already entered for this student.`);
    seen.add(key);
    if (!validDay(r.dueOn)) bad("The due date does not exist.");
    if (paise(r.amount) / 100 !== r.amount && Math.abs(r.amount * 100 - paise(r.amount)) > 1e-6)
      bad("Use at most two decimals for the amount.");
    if (r.paid > r.amount) bad("Paid is more than the amount.");
    if (r.paid > 0) {
      if (r.mode !== "cash" && !r.reference) bad("Enter the transaction or cheque reference.");
      if (r.paidOn && (!validDay(r.paidOn) || r.paidOn > today))
        bad("The payment date must be a real date, not in the future.");
    }
  });
  if (errors.length)
    return NextResponse.json(
      {
        code: "validation",
        message: `${errors.length} row(s) need fixing.`,
        fieldErrors: { rows: errors.map((e) => `Line ${e.line}: ${e.message}`) },
      },
      { status: 422 },
    );

  const totalDue = rows.reduce((s, r) => s + paise(r.amount), 0);
  const totalPaid = rows.reduce((s, r) => s + paise(r.paid), 0);
  const summary = { rows: rows.length, totalDue: totalDue / 100, totalPaid: totalPaid / 100 };
  if (!commit) return NextResponse.json({ ok: true, committed: false, ...summary });

  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const inv = await tx.invoice.create({
        data: {
          tenantId,
          yearId: year.id,
          studentId: byNo.get(r.admissionNo)!,
          number: await nextInvoiceNo(tx, tenantId),
          title: r.title,
          amountPaise: paise(r.amount),
          dueOn: new Date(`${r.dueOn}T00:00:00Z`),
        },
      });
      if (r.paid > 0)
        await tx.payment.create({
          data: {
            tenantId,
            invoiceId: inv.id,
            amountPaise: paise(r.paid),
            mode: r.mode,
            reference: r.reference,
            paidOn: new Date(`${r.paidOn ?? r.dueOn}T00:00:00Z`),
          },
        });
    }
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "opening_balance.import",
        entity: "invoice",
        entityId: `${rows.length} rows`,
      },
    });
  });
  return NextResponse.json({ ok: true, committed: true, ...summary }, { status: 201 });
});
