import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

/** Books a slot. The claim is one conditional update, so two parents cannot both get it. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent"]);
  const { id } = await ctx.params;
  const r = await prisma.ptmSlot.updateMany({
    where: { id, tenantId, bookedByUserId: null },
    data: { bookedByUserId: user.id, bookedByName: user.name },
  });
  if (!r.count) {
    const s = await prisma.ptmSlot.findFirst({ where: { id, tenantId } });
    if (!s) throw new HttpError(404, "not_found", "Slot not found.");
    throw new HttpError(409, "taken", "This slot was just taken. Please pick another.");
  }
  return NextResponse.json({ ok: true, mode: "api", message: "Meeting booked." });
});
