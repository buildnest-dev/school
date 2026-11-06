import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { CERT_DECIDE, certInclude, certView } from "@/server/certificates";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ reason: z.string().trim().min(3).max(200) });

/** Turns down a waiting request, with a reason the parent can read. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CERT_DECIDE]);
  const { id } = await ctx.params;
  const { reason } = Body.parse(await req.json());
  const claim = await prisma.certificate.updateMany({
    where: { id, tenantId, status: "requested" },
    data: { status: "rejected", decisionNote: reason },
  });
  if (claim.count !== 1) {
    const c = await prisma.certificate.findFirst({ where: { id, tenantId } });
    if (!c) throw new HttpError(404, "not_found", "Certificate not found.");
    throw new HttpError(409, "not_requested", `This request is already ${c.status}.`);
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "certificate.reject",
      entity: "certificate",
      entityId: id,
    },
  });
  const c = await prisma.certificate.findFirstOrThrow({ where: { id }, include: certInclude });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Request declined.",
    certificate: certView(c),
  });
});
