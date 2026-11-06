import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  name: z.string().trim().min(2).max(60),
  gstPercent: z.number().int().min(0).max(28).default(0),
});

/** GET /api/fees/heads: the kinds of fee the school charges (Tuition, Transport, ...). */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...FEE_ROLES]);
  const items = await prisma.feeHead.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
  return NextResponse.json({ items });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const b = Body.parse(await req.json());
  if (await prisma.feeHead.findUnique({ where: { tenantId_name: { tenantId, name: b.name } } }))
    throw new HttpError(409, "exists", "A fee head with this name already exists.");
  const head = await prisma.feeHead.create({ data: { tenantId, ...b } });
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "feehead.create",
      entity: "feeHead",
      entityId: head.id,
    },
  });
  return NextResponse.json({ ok: true, mode: "api", id: head.id, head }, { status: 201 });
});
