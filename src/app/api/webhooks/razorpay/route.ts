import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

type Entity = { id?: string; order_id?: string; amount?: number };
type Event = { event?: string; payload?: { payment?: { entity?: Entity } } };

function validSignature(raw: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Gateway callback. Nothing is trusted until the HMAC signature over the raw body checks out.
 * Each event id is processed once, so a retried delivery cannot post the payment twice, and the
 * amount must equal the attempt's amount. The school is taken from the stored attempt.
 */
export const POST = handle(async (req: Request) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret)
    return NextResponse.json(
      { code: "not_configured", message: "Payment callbacks are not configured." },
      { status: 503 },
    );
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-razorpay-signature"), secret))
    return NextResponse.json(
      { code: "bad_signature", message: "Invalid signature." },
      { status: 400 },
    );
  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId)
    return NextResponse.json(
      { code: "no_event_id", message: "Missing event id." },
      { status: 400 },
    );

  let evt: Event;
  try {
    evt = JSON.parse(raw) as Event;
  } catch {
    return NextResponse.json({ code: "bad_body", message: "Not valid JSON." }, { status: 400 });
  }
  const type = evt.event ?? "";
  const pay = evt.payload?.payment?.entity;

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      if (
        await tx.webhookEvent.findUnique({
          where: { gateway_eventId: { gateway: "razorpay", eventId } },
        })
      )
        return "duplicate";
      await tx.webhookEvent.create({ data: { gateway: "razorpay", eventId, type } });
      if (!pay?.order_id) return "ignored";
      const attempt = await tx.paymentAttempt.findUnique({
        where: { gatewayOrderId: pay.order_id },
      });
      if (!attempt) return "unknown_order";

      if (type === "payment.failed") {
        if (attempt.status === "created")
          await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "failed" } });
        return "failed";
      }
      if (type !== "payment.captured") return "ignored";
      if (attempt.status === "paid") return "duplicate";
      if (pay.amount !== attempt.amountPaise || !pay.id) {
        await tx.auditLog.create({
          data: {
            tenantId: attempt.tenantId,
            action: "payment.mismatch",
            entity: "paymentAttempt",
            entityId: attempt.id,
          },
        });
        return "amount_mismatch";
      }
      const invoice = await tx.invoice.findUniqueOrThrow({
        where: { id: attempt.invoiceId },
        include: { payments: true },
      });
      const paidBefore = invoice.payments.reduce((s, p) => s + p.amountPaise, 0);
      const payment = await tx.payment.create({
        data: {
          tenantId: attempt.tenantId,
          invoiceId: attempt.invoiceId,
          amountPaise: attempt.amountPaise,
          mode: "online",
          reference: pay.id,
          gatewayPaymentId: pay.id,
        },
      });
      await tx.paymentAttempt.update({ where: { id: attempt.id }, data: { status: "paid" } });
      await tx.ledgerEntry.create({
        data: {
          tenantId: attempt.tenantId,
          kind: "fee_collected",
          amountPaise: attempt.amountPaise,
          refType: "payment",
          refId: payment.id,
          idempotencyKey: `payment:${pay.id}`,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId: attempt.tenantId,
          action:
            paidBefore + attempt.amountPaise > invoice.amountPaise
              ? "payment.excess"
              : "payment.online",
          entity: "payment",
          entityId: payment.id,
        },
      });
      return "paid";
    });
    return NextResponse.json({ ok: true, outcome });
  } catch (e) {
    // A second delivery of the same event can race past the check; the unique index stops it.
    if ((e as { code?: string }).code === "P2002")
      return NextResponse.json({ ok: true, outcome: "duplicate" });
    throw e;
  }
});
