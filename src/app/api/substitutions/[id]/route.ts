import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant(["school_owner", "principal", "vice_principal"]);
  const { count } = await prisma.substitution.deleteMany({
    where: { id: (await ctx.params).id, tenantId },
  });
  if (!count) throw new HttpError(404, "not_found", "Cover not found.");
  return NextResponse.json({ ok: true, message: "Cover removed." });
});
