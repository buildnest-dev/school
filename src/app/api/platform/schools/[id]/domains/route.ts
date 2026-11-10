import { NextResponse } from "next/server";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";
import { addSchoolDomains } from "@/server/vercel-domains";

/** POST: adds the school's two addresses to the Vercel project again (safe to repeat). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  await requirePlatform(["customer_success"]);
  const { id } = await ctx.params;
  const t = await prisma.tenant.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "not_found", "School not found.");
  return NextResponse.json({ ok: true, domains: await addSchoolDomains(t.slug) });
});
