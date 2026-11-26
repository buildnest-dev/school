import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { phone } from "@/server/validators";

/** The signed-in parent's contact details, as the school holds them. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["parent"]);
  const g = await prisma.guardian.findFirst({ where: { tenantId, userId: user.id } });
  const account = await prisma.user.findUnique({ where: { id: user.id } });
  return NextResponse.json({
    name: g?.name ?? user.name,
    email: account?.email ?? "",
    phone: g?.phone ?? "",
  });
});

const Body = z.object({ phone });

/** A parent keeps their own phone number up to date. Name and e-mail are changed by the school. */
export const PATCH = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent"]);
  const b = Body.parse(await req.json());
  const r = await prisma.guardian.updateMany({
    where: { tenantId, userId: user.id },
    data: { phone: b.phone },
  });
  if (!r.count) throw new HttpError(404, "not_found", "No guardian record is linked to you.");
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "profile.phone",
      entity: "guardian",
      entityId: user.id,
    },
  });
  return NextResponse.json({ ok: true, mode: "api", message: "Saved." });
});
