import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES, rupees } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ amount: rupees, reason: z.string().trim().min(5).max(200) });

/**
 * POST: asks for a refund of all or part of a payment. It changes nothing until a different
 * person (owner or principal) approves it. The total of requested and approved refunds can never
 * exceed the payment.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...FEE_ROLES]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const payment = await prisma.payment.findFirst({ where: { id, tenantId } });
  if (!payment || payment.amountPaise <= 0)
    throw new HttpError(404, "not_found", "Payment not found.");

  const refund = await prisma.$transaction(async (tx) => {
    const open = await tx.refund.aggregate({
      where: { tenantId, paymentId: id, status: { in: ["requested", "approved"] } },
      _sum: { amountPaise: true },
    });
    const left = payment.amountPaise - (open._sum.amountPaise ?? 0);
    if (b.amount > left)
      throw new HttpError(
        409,
        "over_refund",
        `Only Rs ${(left / 100).toFixed(2)} of this payment can still be refunded.`,
      );
    const r = await tx.refund.create({
      data: {
        tenantId,
        paymentId: id,
        amountPaise: b.amount,
        reason: b.reason,
        requestedById: user.id,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "refund.request",
        entity: "refund",
        entityId: r.id,
      },
    });
    return r;
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: refund.id, status: "requested" },
    { status: 201 },
  );
});
