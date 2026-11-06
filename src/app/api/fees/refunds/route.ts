import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { handle } from "@/server/http";

/** GET ?status=requested|approved|rejected: refund requests of this school, newest first. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...FEE_ROLES]);
  const status = new URL(req.url).searchParams.get("status");
  const rows = await prisma.refund.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const payments = await prisma.payment.findMany({
    where: { id: { in: rows.map((r) => r.paymentId) } },
    include: { invoice: { include: { student: { select: { name: true } } } } },
  });
  const byId = new Map(payments.map((p) => [p.id, p]));
  return NextResponse.json({
    items: rows.map((r) => {
      const p = byId.get(r.paymentId);
      return {
        id: r.id,
        status: r.status,
        amount: r.amountPaise / 100,
        reason: r.reason,
        requestedAt: r.createdAt.toISOString(),
        invoiceNumber: p?.invoice.number ?? null,
        studentName: p?.invoice.student.name ?? null,
      };
    }),
  });
});
