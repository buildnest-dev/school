import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.discriminatedUnion("approve", [
  z.object({
    approve: z.literal(true),
    invoiceId: z.string().min(1),
    /** Overrides what the parent typed, e.g. the transaction id read from the bank statement. */
    reference: z.string().trim().min(3).max(60).optional(),
  }),
  z.object({ approve: z.literal(false), note: z.string().trim().min(3, "Say why").max(300) }),
]);

/**
 * POST: the accountant checks the screenshot against the bank statement. Approving records a
 * normal UPI payment on the chosen invoice; rejecting keeps nothing but the reason.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...FEE_ROLES]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());

  const result = await prisma.$transaction(async (tx) => {
    const proof = await tx.paymentProof.findFirst({
      where: { id, tenantId },
      omit: { image: true },
    });
    if (!proof) throw new HttpError(404, "not_found", "Not found.");
    if (proof.status !== "pending")
      throw new HttpError(409, "already_decided", "This payment proof was already reviewed.");

    if (!b.approve) {
      await tx.paymentProof.update({
        where: { id },
        data: {
          status: "rejected",
          reviewNote: b.note,
          reviewedBy: user.id,
          reviewedAt: new Date(),
        },
      });
      return { status: "rejected" as const };
    }

    const reference = b.reference ?? proof.reference ?? "";
    if (!reference)
      throw new HttpError(422, "reference_required", "Enter the UPI transaction reference.");
    const inv = await tx.invoice.findFirst({
      where: { id: b.invoiceId, tenantId, studentId: proof.studentId },
      include: { payments: true },
    });
    if (!inv) throw new HttpError(404, "not_found", "Invoice not found for this student.");
    if (await tx.payment.findFirst({ where: { tenantId, reference, mode: "upi" } }))
      throw new HttpError(
        409,
        "reference_used",
        "A payment with this transaction reference is already recorded.",
      );
    const paid = inv.payments.reduce((s, p) => s + p.amountPaise, 0);
    if (paid + proof.amountPaise > inv.amountPaise)
      throw new HttpError(422, "overpayment", "This payment is more than the balance due.");

    const payment = await tx.payment.create({
      data: {
        tenantId,
        invoiceId: inv.id,
        amountPaise: proof.amountPaise,
        mode: "upi",
        reference,
      },
    });
    // The status check in `where` makes a second, simultaneous approval a no-op.
    const claimed = await tx.paymentProof.updateMany({
      where: { id, status: "pending" },
      data: {
        status: "approved",
        reference,
        paymentId: payment.id,
        reviewedBy: user.id,
        reviewedAt: new Date(),
      },
    });
    if (claimed.count !== 1)
      throw new HttpError(409, "already_decided", "This payment proof was already reviewed.");
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "payment.proof_approved",
        entity: "invoice",
        entityId: inv.id,
      },
    });
    return { status: "approved" as const, paymentId: payment.id };
  });
  return NextResponse.json({ ok: true, ...result });
});
