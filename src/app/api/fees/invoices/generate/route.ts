import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { netAfter, nextInvoiceNo, rupees } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";
import { idempotent } from "@/server/idempotency";

const MAX_STUDENTS = 2000;

const Body = z
  .object({
    sectionId: z.string().optional(),
    classId: z.string().optional(),
    title: z.string().trim().min(2).max(80),
    amount: rupees,
    dueOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD"),
    /** Percent off for everyone (a scholarship or a school-wide concession). */
    discountPercent: z.number().min(0).max(100).default(0),
    discountReason: z.string().trim().max(80).optional(),
    /** Extra percent off for the second and later children of the same guardian. */
    siblingDiscountPercent: z.number().min(0).max(100).default(0),
    /** Count only without saving anything. */
    preview: z.boolean().default(false),
  })
  .refine((b) => !!b.sectionId !== !!b.classId, "Give either sectionId or classId");

/**
 * POST: raises the same fee for every active student of a section or class, with optional
 * concessions. A student who already has an invoice with this title this year is skipped, so
 * running it twice never bills anyone twice. Use preview:true to see the totals first.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "accountant"]);
  const raw: unknown = await req.json();
  const b = Body.parse(raw);
  if (Number.isNaN(Date.parse(b.dueOn)))
    throw new HttpError(422, "bad_date", "That date does not exist.");
  const year = await prisma.academicYear.findFirst({ where: { tenantId, current: true } });
  if (!year) throw new HttpError(409, "no_year", "Set the current academic year first.");

  return idempotent(req, tenantId, "invoice.generate", raw, async () => {
    const students = await prisma.student.findMany({
      where: {
        tenantId,
        status: "active",
        ...(b.sectionId ? { sectionId: b.sectionId } : { section: { classId: b.classId } }),
      },
      orderBy: { admissionNo: "asc" },
    });
    if (students.length === 0)
      throw new HttpError(404, "no_students", "No active students in that section or class.");
    if (students.length > MAX_STUDENTS)
      throw new HttpError(422, "too_many", `Bill at most ${MAX_STUDENTS} students at once.`);

    // A child's place among their family: children sharing a guardian record or a guardian phone
    // number count as siblings (oldest admission first). A school may enter a guardian twice.
    const everyone = await prisma.student.findMany({
      where: { tenantId, status: "active", guardianId: { not: null } },
      orderBy: { admissionNo: "asc" },
      select: { id: true, guardianId: true, guardian: { select: { phone: true } } },
    });
    const rank = new Map<string, number>();
    const seen = new Map<string, number>();
    for (const f of everyone) {
      const key = f.guardian?.phone ?? f.guardianId!;
      const n = seen.get(key) ?? 0;
      rank.set(f.id, n);
      seen.set(key, n + 1);
    }
    const already = new Set(
      (
        await prisma.invoice.findMany({
          where: {
            tenantId,
            yearId: year.id,
            title: b.title,
            studentId: { in: students.map((s) => s.id) },
          },
          select: { studentId: true },
        })
      ).map((i) => i.studentId),
    );

    const plan = students
      .filter((s) => !already.has(s.id))
      .map((s) => {
        const sibling = (rank.get(s.id) ?? 0) > 0 && b.siblingDiscountPercent > 0;
        const percents = [b.discountPercent, sibling ? b.siblingDiscountPercent : 0].filter(
          (p) => p > 0,
        );
        const net = netAfter(b.amount, percents);
        const reasons = [
          b.discountPercent > 0 ? `${b.discountReason ?? "Concession"} ${b.discountPercent}%` : "",
          sibling ? `Sibling ${b.siblingDiscountPercent}%` : "",
        ].filter(Boolean);
        return { student: s, net, reason: reasons.join(", ") || null };
      });
    const summary = {
      matched: students.length,
      skipped: already.size,
      toCreate: plan.length,
      totalPayable: plan.reduce((t, p) => t + p.net, 0) / 100,
      totalDiscount: plan.reduce((t, p) => t + (b.amount - p.net), 0) / 100,
    };
    if (b.preview)
      return { status: 200, body: { ok: true, mode: "api", preview: true, ...summary } };

    await prisma.$transaction(
      async (tx) => {
        for (const p of plan)
          await tx.invoice.create({
            data: {
              tenantId,
              yearId: year.id,
              studentId: p.student.id,
              number: await nextInvoiceNo(tx, tenantId),
              title: b.title,
              amountPaise: p.net,
              grossPaise: p.net === b.amount ? null : b.amount,
              discountPaise: b.amount - p.net,
              discountReason: p.reason,
              dueOn: new Date(`${b.dueOn}T00:00:00Z`),
            },
          });
        await tx.auditLog.create({
          data: {
            tenantId,
            userId: user.id,
            action: "invoice.generate",
            entity: "invoice",
            entityId: null,
          },
        });
      },
      { timeout: 60_000 },
    );
    return {
      status: 201,
      body: { ok: true, mode: "api", preview: false, ...summary, created: plan.length },
    };
  });
});
