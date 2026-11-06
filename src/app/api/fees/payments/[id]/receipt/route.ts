import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { nextReceiptNo, paidOf } from "@/server/fees";
import { handle } from "@/server/http";

/**
 * GET: the data for a payment receipt. The receipt number is given the first time a receipt is
 * asked for and never changes. Staff who handle fees can read any receipt; a parent only those
 * of their own children.
 */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "accountant",
    "parent",
  ]);
  const { id } = await ctx.params;
  const payment = await prisma.payment.findFirst({
    where: {
      id,
      tenantId,
      amountPaise: { gt: 0 },
      ...(user.role === "parent"
        ? { invoice: { student: { guardian: { userId: user.id } } } }
        : {}),
    },
  });
  if (!payment) throw new HttpError(404, "not_found", "Receipt not found.");

  let receiptNo = payment.receiptNo;
  for (let attempt = 0; !receiptNo && attempt < 5; attempt++) {
    try {
      await prisma.$transaction(async (tx) => {
        const no = await nextReceiptNo(tx, tenantId);
        const claim = await tx.payment.updateMany({
          where: { id, receiptNo: null },
          data: { receiptNo: no },
        });
        if (claim.count === 1) receiptNo = no;
      });
      if (!receiptNo)
        receiptNo = (await prisma.payment.findUniqueOrThrow({ where: { id } })).receiptNo;
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // another receipt took that number
    }
  }
  if (!receiptNo) throw new HttpError(503, "busy", "Could not number the receipt. Try again.");

  const [tenant, inv] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    prisma.invoice.findUniqueOrThrow({
      where: { id: payment.invoiceId },
      include: {
        payments: true,
        student: { include: { section: { include: { class: true } } } },
      },
    }),
  ]);
  return NextResponse.json({
    receiptNo,
    school: { name: tenant.name, address: tenant.address, phone: tenant.phone },
    student: {
      name: inv.student.name,
      admissionNo: inv.student.admissionNo,
      classSection: inv.student.section
        ? `${inv.student.section.class.name} ${inv.student.section.name}`
        : null,
    },
    invoice: { number: inv.number, title: inv.title, payable: inv.amountPaise / 100 },
    payment: {
      amount: payment.amountPaise / 100,
      mode: payment.mode,
      reference: payment.reference,
      paidOn: payment.paidOn.toISOString(),
    },
    balanceNow: (inv.amountPaise - paidOf(inv)) / 100,
  });
});
