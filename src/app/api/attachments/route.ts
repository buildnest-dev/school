import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { assertFileAccess, readFile } from "@/server/attachments";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { assertSameOrigin, handle, throttle } from "@/server/http";

const Entity = z.enum(["student", "material"]);

export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant();
  const q = new URL(req.url).searchParams;
  const entity = Entity.parse(q.get("entity"));
  const entityId = z.string().min(1).parse(q.get("entityId"));
  await assertFileAccess(tenantId, user, entity, entityId, false);
  const rows = await prisma.attachment.findMany({
    where: { tenantId, entity, entityId },
    omit: { bytes: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      size: r.size,
      mime: r.mime,
      addedOn: dayStr(r.createdAt),
      canRemove: r.uploadedById === user.id || ["school_owner", "principal"].includes(user.role),
    })),
  );
});

const Body = z.object({
  entity: Entity,
  entityId: z.string().min(1),
  name: z.string().trim().min(1).max(120),
  data: z.string().min(12).max(1_500_000),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant();
  await throttle(`upload|${user.id}`, 20, 10 * 60_000);
  const b = Body.parse(await req.json());
  await assertFileAccess(tenantId, user, b.entity, b.entityId, true);
  const { bytes, mime } = readFile(b.data);
  const count = await prisma.attachment.count({
    where: { tenantId, entity: b.entity, entityId: b.entityId },
  });
  if (count >= 10)
    throw new HttpError(409, "too_many", "Ten files are kept here. Remove one first.");
  await prisma.attachment.create({
    data: {
      tenantId,
      entity: b.entity,
      entityId: b.entityId,
      name: b.name.replace(/[^\p{L}\p{N} ._()-]/gu, "_"),
      mime,
      size: bytes.length,
      bytes: new Uint8Array(bytes),
      uploadedById: user.id,
    },
  });
  return NextResponse.json({ ok: true, message: "File saved." }, { status: 201 });
});
