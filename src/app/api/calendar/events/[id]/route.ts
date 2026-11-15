import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

export const DELETE = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN]);
  const { id } = await ctx.params;
  const r = await prisma.calendarEvent.deleteMany({ where: { id, tenantId } });
  if (!r.count) throw new HttpError(404, "not_found", "Event not found.");
  return NextResponse.json({ ok: true, mode: "api", message: "Removed." });
});
