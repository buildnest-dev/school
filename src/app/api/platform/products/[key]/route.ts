import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

const Body = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  summary: z.string().trim().min(5).max(300).optional(),
  status: z.enum(["available", "coming_soon", "retired"]).optional(),
  position: z.number().int().min(0).max(999).optional(),
});

/** PATCH: product managers edit the public catalog entry. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ key: string }> }) => {
  assertSameOrigin(req);
  await requirePlatform(["product_manager"]);
  const { key } = await ctx.params;
  const b = Body.parse(await req.json());
  if (!(await prisma.product.findUnique({ where: { key } })))
    throw new HttpError(404, "not_found", "Product not found.");
  const product = await prisma.product.update({ where: { key }, data: b });
  return NextResponse.json({ ok: true, mode: "api", product });
});
