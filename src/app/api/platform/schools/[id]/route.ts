import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { PLANS, goLiveChecklist, schoolRow } from "@/server/platform";
import { phone } from "@/server/validators";

type Ctx = { params: Promise<{ id: string }> };

async function load(id: string) {
  const t = await prisma.tenant.findUnique({ where: { id }, include: { bank: true } });
  if (!t) throw new HttpError(404, "not_found", "School not found.");
  return t;
}

/** Details for the platform team: status, subscription, checklist, masked bank and counts. No student records. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  await requireAuth(["platform_admin"]);
  const t = await load((await ctx.params).id);
  const [checklist, students, staff, logins] = await Promise.all([
    goLiveChecklist(t.id),
    prisma.student.count({ where: { tenantId: t.id, status: "active" } }),
    prisma.staff.count({ where: { tenantId: t.id, status: "active" } }),
    prisma.membership.count({ where: { tenantId: t.id } }),
  ]);
  return NextResponse.json({
    ...(await schoolRow(t)),
    checklist,
    counts: { activeStudents: students, activeStaff: staff, logins },
    bank: t.bank
      ? {
          holderName: t.bank.holderName,
          bankName: t.bank.bankName,
          ifsc: t.bank.ifsc,
          accountMasked: `XXXXXX${t.bank.accountLast4}`,
        }
      : null,
  });
});

const Patch = z
  .object({
    name: z.string().trim().min(3).max(120),
    phone,
    email: z.string().trim().toLowerCase().email(),
    address: z.string().trim().max(300),
    plan: z.enum(PLANS),
    planPeriod: z.enum(["monthly", "yearly"]),
    subscription: z.enum(["trial", "active", "cancelled"]),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    graceDays: z.number().int().min(0).max(60),
    suspended: z.boolean(),
  })
  .partial();

/** PATCH: change plan or renewal date, suspend or reactivate, edit contact details. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { user } = await requireAuth(["platform_admin"]);
  const t = await load((await ctx.params).id);
  const { suspended, periodEnd, ...rest } = Patch.parse(await req.json());
  if (periodEnd && Number.isNaN(Date.parse(periodEnd)))
    throw new HttpError(422, "bad_date", "That date does not exist.");

  let status = t.status;
  if (suspended === true) status = "suspended";
  if (suspended === false && t.status === "suspended")
    status = t.wentLiveAt ? "live" : "provisioned";
  const action =
    suspended === true
      ? "school.suspend"
      : suspended === false
        ? "school.reactivate"
        : "school.update";

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.tenant.update({
      where: { id: t.id },
      data: {
        ...rest,
        status,
        ...(periodEnd ? { periodEnd: new Date(`${periodEnd}T23:59:59Z`) } : {}),
      },
    });
    await tx.auditLog.create({
      data: { tenantId: t.id, userId: user.id, action, entity: "tenant", entityId: t.id },
    });
    return u;
  });
  return NextResponse.json({ ok: true, mode: "api", school: await schoolRow(updated) });
});
