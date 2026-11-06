import { NextResponse } from "next/server";
import { z } from "zod";
import { createLogin, originOf } from "@/server/accounts";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { idempotent } from "@/server/idempotency";
import { PLANS, schoolRow, slugField, requirePlatform } from "@/server/platform";
import { personName, phone } from "@/server/validators";

const Body = z.object({
  name: z.string().trim().min(3, "Enter the school name").max(120),
  slug: slugField,
  ownerName: personName,
  ownerEmail: z.string().trim().toLowerCase().email(),
  phone: phone.optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  address: z.string().trim().max(300).optional(),
  stateId: z.string().optional(),
  boardCodes: z.array(z.string().trim().toUpperCase()).min(1, "Choose at least one board").max(8),
  /** First year label, e.g. 2026-27. The year runs 1 April to 31 March. */
  yearLabel: z.string().regex(/^\d{4}-\d{2}$/, "Use the format 2026-27"),
  plan: z.enum(PLANS).default("trial"),
  planPeriod: z.enum(["monthly", "yearly"]).default("monthly"),
  trialDays: z.number().int().min(0).max(90).default(30),
});

/** GET /api/platform/schools: every school with its status and subscription. */
export const GET = handle(async (req: Request) => {
  await requirePlatform(["sales", "finance", "customer_success", "support"]);
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("status");
  const rows = await prisma.tenant.findMany({
    where: {
      ...(q ? { OR: [{ name: { contains: q } }, { slug: { contains: q } }] } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const counts = await prisma.student.groupBy({
    by: ["tenantId"],
    where: { status: "active", tenantId: { in: rows.map((r) => r.id) } },
    _count: true,
  });
  const byTenant = new Map(counts.map((c) => [c.tenantId, c._count]));
  const items = await Promise.all(
    rows.map(async (r) => ({ ...(await schoolRow(r)), activeStudents: byTenant.get(r.id) ?? 0 })),
  );
  return NextResponse.json({ items, total: items.length });
});

/**
 * POST /api/platform/schools: creates the school's workspace in the Provisioned state, with its
 * boards, a first campus, the first academic year and an owner login (invite by e-mail).
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(["customer_success"]);
  const raw: unknown = await req.json();
  const b = Body.parse(raw);

  return idempotent(req, "platform", "school.create", raw, async () => {
    if (await prisma.tenant.findUnique({ where: { slug: b.slug } }))
      throw new HttpError(409, "slug_taken", "That school address name is already used.");
    const boards = await prisma.board.findMany({ where: { code: { in: b.boardCodes } } });
    if (boards.length !== new Set(b.boardCodes).size)
      throw new HttpError(422, "bad_board", "One of the boards is not recognised.");
    if (b.stateId && !(await prisma.state.findUnique({ where: { id: b.stateId } })))
      throw new HttpError(422, "bad_state", "Unknown state.");
    const startYear = Number(b.yearLabel.slice(0, 4));
    if (Number(b.yearLabel.slice(5)) !== (startYear + 1) % 100)
      throw new HttpError(422, "bad_year", "The year label must be consecutive, like 2026-27.");

    const tenant = await prisma.$transaction(async (tx) => {
      const t = await tx.tenant.create({
        data: {
          slug: b.slug,
          name: b.name,
          status: "provisioned",
          plan: b.plan,
          planPeriod: b.planPeriod,
          subscription: "trial",
          periodEnd: new Date(Date.now() + b.trialDays * 86_400_000),
          phone: b.phone,
          email: b.email,
          address: b.address,
          stateId: b.stateId,
        },
      });
      for (const bd of boards)
        await tx.tenantBoard.create({
          data: { tenantId: t.id, boardId: bd.id, isDefault: bd.code === b.boardCodes[0] },
        });
      await tx.campus.create({ data: { tenantId: t.id, name: "Main campus", address: b.address } });
      await tx.academicYear.create({
        data: {
          tenantId: t.id,
          label: b.yearLabel,
          startsOn: new Date(Date.UTC(startYear, 3, 1)),
          endsOn: new Date(Date.UTC(startYear + 1, 2, 31)),
          current: true,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: t.id,
          userId: user.id,
          action: "school.create",
          entity: "tenant",
          entityId: t.id,
        },
      });
      return t;
    });
    await createLogin(tenant.id, tenant.name, {
      email: b.ownerEmail,
      name: b.ownerName,
      role: "school_owner",
      origin: originOf(req),
    });
    return { status: 201, body: { ok: true, mode: "api", school: await schoolRow(tenant) } };
  });
});
