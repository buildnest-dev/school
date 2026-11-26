import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };
const Body = z.object({ status: z.enum(["planned", "taught"]) });

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["teacher"]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const r = await prisma.lessonPlan.updateMany({
    where: { id, tenantId, createdById: user.id },
    data: b,
  });
  if (!r.count) throw new HttpError(404, "not_found", "Lesson plan not found.");
  return NextResponse.json({ ok: true, mode: "api", message: "Saved." });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["teacher"]);
  const { id } = await ctx.params;
  const r = await prisma.lessonPlan.deleteMany({ where: { id, tenantId, createdById: user.id } });
  if (!r.count) throw new HttpError(404, "not_found", "Lesson plan not found.");
  return NextResponse.json({ ok: true, mode: "api", message: "Removed." });
});
