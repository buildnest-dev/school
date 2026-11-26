import { NextResponse } from "next/server";
import { z } from "zod";
import { FEATURE_KEYS } from "@/config/features";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

const Body = z.object({
  disabled: z
    .array(z.string().refine((k) => FEATURE_KEYS.includes(k), "Unknown feature"))
    .max(FEATURE_KEYS.length),
});

/**
 * PUT: the features switched off for one school. Takes effect on the school's next request. Records
 * already saved under a feature are kept and come back when it is switched on again.
 */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(["customer_success", "finance"]);
  const { id } = await ctx.params;
  const disabled = [...new Set(Body.parse(await req.json()).disabled)];
  const t = await prisma.tenant.findUnique({ where: { id }, select: { id: true } });
  if (!t) throw new HttpError(404, "not_found", "School not found.");
  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { disabledFeatures: disabled.join(",") } }),
    prisma.auditLog.create({
      data: {
        tenantId: id,
        userId: user.id,
        action: "school.features",
        entity: "tenant",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "Features saved.", disabled });
});
