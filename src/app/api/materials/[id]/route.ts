import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { CLASS_STAFF } from "@/server/classwork";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const { id } = await ctx.params;
  const r = await prisma.studyMaterial.deleteMany({
    where: { id, tenantId, ...(user.role === "teacher" ? { createdById: user.id } : {}) },
  });
  if (!r.count) throw new HttpError(404, "not_found", "Material not found.");
  return NextResponse.json({ ok: true, mode: "api", message: "Removed." });
});
