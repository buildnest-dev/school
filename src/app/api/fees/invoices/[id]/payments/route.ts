import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  amountRupees: z.number().positive().max(10_000_000),
  mode: z.enum(["cash", "upi", "cheque", "dd", "netbanking", "card"]),
  reference: z.string().trim().max(60).optional(),
});

/** Records a payment that was received (cash/UPI/cheque...). It does NOT move money: no gateway is integrated. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["accountant", "principal", "school_owner"]);
  const { id } = await ctx.params;
  const body = Body.parse(await req.json());
  if (body.mode !== "cash" && !body.reference)
    throw new HttpError(422, "reference_required", "Enter the UPI/cheque/transaction reference.");
  const amountPaise = Math.round(body.amountRupees * 100);

  const payment = await prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findFirst({
      where: { id, tenantId },
      include: { payments: true },
    });
    if (!inv) throw new HttpError(404, "not_found", "Invoice not found.");
    const paid = inv.payments.reduce((s, p) => s + p.amountPaise, 0);
    if (paid + amountPaise > inv.amountPaise)
      throw new HttpError(422, "overpayment", "This payment is more than the balance due.");
    const p = await tx.payment.create({
      data: { tenantId, invoiceId: id, amountPaise, mode: body.mode, reference: body.reference },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "payment.record",
        entity: "invoice",
        entityId: id,
      },
    });
    return p;
  });
  return NextResponse.json({ ok: true, mode: "api", id: payment.id, message: "Payment recorded." });
});
