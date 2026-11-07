import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { decryptSecret } from "@/server/secret";

/** GET: where a parent or student pays their school. Nothing here moves money; it only shows details. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant(["parent", "student"]);
  const [b, t] = await Promise.all([
    prisma.tenantBank.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { name: true } }),
  ]);
  if (!b) return NextResponse.json({ set: false, schoolName: t?.name ?? "" });
  return NextResponse.json({
    set: true,
    schoolName: t?.name ?? "",
    holderName: b.holderName,
    bankName: b.bankName,
    ifsc: b.ifsc,
    accountNumber: decryptSecret(b.accountCipher),
    upiId: b.upiId,
  });
});
