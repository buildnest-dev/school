import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN_FIN } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ status: z.enum(["active", "inactive"]) });

export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN_FIN]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const r = await prisma.vendor.updateMany({ where: { id, tenantId }, data: { status: b.status } });
  if (!r.count) throw new HttpError(404, "not_found", "Vendor not found.");
  return NextResponse.json({ ok: true, mode: "api", message: "Saved." });
});
