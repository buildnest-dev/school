import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { paidOf } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

/**
 * POST: a parent starts an online payment for the balance of their child's invoice.
 * This only creates an attempt. The invoice is marked paid later, by the gateway's verified
 * callback (/api/webhooks/razorpay), never because the browser says it paid.
 *
 * No gateway account is connected yet, so the order is a stub (mode "stub"); when Razorpay keys
 * are added, only the order creation below changes.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent"]);
  const { id } = await ctx.params;
  const inv = await prisma.invoice.findFirst({
    where: { id, tenantId, student: { guardian: { userId: user.id } } },
    include: { payments: true },
  });
  if (!inv) throw new HttpError(404, "not_found", "Invoice not found.");
  const due = inv.amountPaise - paidOf(inv);
  if (due <= 0) throw new HttpError(409, "paid", "This invoice is already paid.");

  const attempt = await prisma.paymentAttempt.create({
    data: {
      tenantId,
      invoiceId: inv.id,
      amountPaise: due,
      gateway: "stub",
      gatewayOrderId: `order_stub_${randomBytes(9).toString("hex")}`,
    },
  });
  return NextResponse.json(
    {
      ok: true,
      mode: "stub",
      attemptId: attempt.id,
      orderId: attempt.gatewayOrderId,
      amount: due / 100,
      message: "Payment gateway is not connected yet. This is a test order.",
    },
    { status: 201 },
  );
});
