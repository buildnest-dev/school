import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { CERT_DECIDE, certInclude, certView } from "@/server/certificates";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ reason: z.string().trim().min(3).max(200) });

/**
 * Cancels an issued certificate (for example one issued by mistake). The serial number stays
 * on record and public verification then reports it as cancelled. Cancelling a transfer
 * certificate does not re-enrol the student; change their status on the student record.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CERT_DECIDE]);
  const { id } = await ctx.params;
  const { reason } = Body.parse(await req.json());
  const claim = await prisma.certificate.updateMany({
    where: { id, tenantId, status: "issued" },
    data: { status: "cancelled", decisionNote: reason },
  });
  if (claim.count !== 1) {
    const c = await prisma.certificate.findFirst({ where: { id, tenantId } });
    if (!c) throw new HttpError(404, "not_found", "Certificate not found.");
    throw new HttpError(
      409,
      "not_issued",
      `Only an issued certificate can be cancelled (this one is ${c.status}).`,
    );
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "certificate.cancel",
      entity: "certificate",
      entityId: id,
    },
  });
  const c = await prisma.certificate.findFirstOrThrow({ where: { id }, include: certInclude });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Certificate cancelled.",
    certificate: certView(c, true),
  });
});
