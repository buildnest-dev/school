import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ approve: z.boolean() });

/**
 * POST: the owner or principal approves or rejects a refund, and it cannot be the person who asked.
 * Approval posts a negative payment on the invoice (so the balance is due again) and, for an online
 * payment, a negative ledger entry. Money is not sent back automatically: the school pays it out
 * (or refunds through the gateway) and this is the record.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const { approve } = Body.parse(await req.json());
  const refund = await prisma.refund.findFirst({ where: { id, tenantId } });
  if (!refund) throw new HttpError(404, "not_found", "Refund not found.");
  if (refund.requestedById === user.id)
    throw new HttpError(403, "same_person", "A different person must decide this refund.");
  if (refund.status !== "requested")
    throw new HttpError(409, "decided", "This refund was already decided.");

  await prisma.$transaction(async (tx) => {
    const claim = await tx.refund.updateMany({
      where: { id, tenantId, status: "requested" },
      data: {
        status: approve ? "approved" : "rejected",
        decidedById: user.id,
        decidedAt: new Date(),
      },
    });
    if (claim.count !== 1) throw new HttpError(409, "decided", "This refund was already decided.");
    if (approve) {
      const orig = await tx.payment.findUniqueOrThrow({ where: { id: refund.paymentId } });
      const neg = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: orig.invoiceId,
          amountPaise: -refund.amountPaise,
          mode: "refund",
          reference: refund.id,
        },
      });
      if (orig.gatewayPaymentId)
        await tx.ledgerEntry.create({
          data: {
            tenantId,
            kind: "refund",
            amountPaise: -refund.amountPaise,
            refType: "refund",
            refId: refund.id,
            idempotencyKey: `refund:${refund.id}`,
          },
        });
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "refund.approve",
          entity: "payment",
          entityId: neg.id,
        },
      });
    } else {
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "refund.reject",
          entity: "refund",
          entityId: id,
        },
      });
    }
  });
  return NextResponse.json({ ok: true, mode: "api", status: approve ? "approved" : "rejected" });
});
