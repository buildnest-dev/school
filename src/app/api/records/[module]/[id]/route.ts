import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { assertNoOverlap, readable, readFields, registerFor } from "@/server/registers";

type Ctx = { params: Promise<{ module: string; id: string }> };

/** The record, if this person may read it, and whether they may change it. */
async function find(ctx: Ctx) {
  const { tenantId, user } = await requireTenant();
  const { module, id } = await ctx.params;
  const { def, rights } = registerFor(module, user);
  const row = await prisma.schoolRecord.findFirst({
    where: { AND: [await readable(tenantId, user, def, rights), { id }] },
  });
  if (!row) throw new HttpError(404, "not_found", "Record not found.");
  const own = rights.submit && row.createdById === user.id && row.status === def.statuses[0];
  if (!rights.manage && !own)
    throw new HttpError(403, "forbidden", "You cannot change this record any more.");
  return { tenantId, user, def, rights, row };
}

const Body = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  status: z.string().max(30).optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user, def, rights, row } = await find(ctx);
  const b = Body.parse(await req.json());
  if (b.status && !rights.manage)
    throw new HttpError(403, "forbidden", "Only the school changes the stage.");
  const status = b.status ?? row.status;
  if (!def.statuses.includes(status)) throw new HttpError(422, "bad_status", "Unknown stage.");
  const data = {
    ...(JSON.parse(row.data) as Record<string, string>),
    ...readFields(def, b.data ?? {}, rights.manage, true),
  };
  await prisma.$transaction(async (tx) => {
    await assertNoOverlap(tx, tenantId, def, data, status, row.id);
    await tx.schoolRecord.update({
      where: { id: row.id },
      data: {
        title: b.title ?? row.title,
        status,
        data: JSON.stringify(data),
        onDate: data.date ? new Date(data.date) : null,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: b.status ? `record.${b.status}` : "record.update",
        entity: def.key,
        entityId: row.id,
      },
    });
  });
  return NextResponse.json({ ok: true, message: "Saved." });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user, def, row } = await find(ctx);
  await prisma.$transaction([
    prisma.schoolRecord.delete({ where: { id: row.id } }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "record.delete",
        entity: def.key,
        entityId: row.id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, message: "Removed." });
});
