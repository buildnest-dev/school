import { z } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export const FEE_ROLES = ["school_owner", "principal", "accountant"] as const;
export const PAY_MODES = ["cash", "upi", "cheque", "dd", "netbanking", "card", "online"] as const;

/** Rupees with at most two decimals, converted to whole paise (no floating-point drift). */
export const rupees = z
  .number()
  .positive("Enter an amount above zero")
  .max(10_000_000, "That amount is too large")
  .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, "Use at most two decimals")
  .transform((v) => Math.round(v * 100));

/** INV-<year>-<0001...>. The unique index on (tenantId, number) guards against two at once. */
export async function nextInvoiceNo(tx: Tx, tenantId: string) {
  const prefix = `INV-${new Date().getUTCFullYear()}-`;
  const last = await tx.invoice.findFirst({
    where: { tenantId, number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(5, "0")}`;
}

export async function invoiceOr404(tenantId: string, id: string) {
  const inv = await prisma.invoice.findFirst({
    where: { id, tenantId },
    include: { payments: true, student: { include: { guardian: true } } },
  });
  if (!inv) throw new HttpError(404, "not_found", "Invoice not found.");
  return inv;
}

export const paidOf = (inv: { payments: { amountPaise: number }[] }) =>
  inv.payments.reduce((s, p) => s + p.amountPaise, 0);
