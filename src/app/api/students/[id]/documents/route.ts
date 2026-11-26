import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Office list of one student's printable papers. Certificates are for the school head only. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "accountant"]);
  const student = await prisma.student.findFirst({
    where: { id: (await ctx.params).id, tenantId },
  });
  if (!student) throw new HttpError(404, "not_found", "Student not found.");
  const [certs, payments] = await Promise.all([
    user.role === "accountant"
      ? []
      : prisma.certificate.findMany({
          where: { tenantId, studentId: student.id, status: "issued" },
        }),
    prisma.payment.findMany({
      where: { tenantId, invoice: { studentId: student.id }, amountPaise: { gt: 0 } },
      include: { invoice: { select: { title: true } } },
    }),
  ]);
  return NextResponse.json(
    [
      ...certs.map((c) => ({
        id: c.id,
        kind: "Certificate",
        title: `${c.type.charAt(0).toUpperCase() + c.type.slice(1)} certificate`,
        reference: c.serialNo ?? "",
        date: c.issuedOn ? dayStr(c.issuedOn) : "",
      })),
      ...payments.map((p) => ({
        id: p.id,
        kind: "Fee payment",
        title: `${p.invoice.title} · ₹${new Intl.NumberFormat("en-IN").format(p.amountPaise / 100)}`,
        reference: p.receiptNo ?? p.reference ?? "",
        date: dayStr(p.paidOn),
      })),
    ].sort((a, b) => b.date.localeCompare(a.date)),
  );
});
