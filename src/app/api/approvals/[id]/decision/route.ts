import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(300).optional(),
});

/** Approves or rejects a leave request. A request is decided once; asking again is refused. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...ADMIN]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const r = await prisma.leaveRequest.updateMany({
    where: { id, tenantId, status: "pending" },
    data: { status: b.decision, decidedBy: user.name, decidedAt: new Date(), note: b.note ?? null },
  });
  if (!r.count) {
    const l = await prisma.leaveRequest.findFirst({ where: { id, tenantId } });
    if (!l) throw new HttpError(404, "not_found", "Request not found.");
    throw new HttpError(409, "already_decided", "This request was already decided.");
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: `leave.${b.decision}`,
      entity: "leave",
      entityId: id,
    },
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: b.decision === "approved" ? "Approved." : "Rejected.",
  });
});
