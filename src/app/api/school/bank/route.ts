import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { decryptSecret, encryptSecret } from "@/server/secret";
import { personName } from "@/server/validators";

const ROLES = ["school_owner", "principal", "accountant"] as const;

const Body = z.object({
  holderName: personName,
  bankName: z.string().trim().min(2).max(80),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Enter a valid IFSC code"),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{9,18}$/, "Account numbers are 9 to 18 digits"),
  upiId: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/, "Enter a valid UPI ID, like school@bank")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

/** GET: the school's own collection details, for the people who may change them. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...ROLES]);
  const b = await prisma.tenantBank.findUnique({ where: { tenantId } });
  if (!b) return NextResponse.json({ set: false });
  return NextResponse.json({
    set: true,
    holderName: b.holderName,
    bankName: b.bankName,
    ifsc: b.ifsc,
    accountNumber: decryptSecret(b.accountCipher),
    upiId: b.upiId,
  });
});

/**
 * PUT: the school saves the account its fees are paid into. Parents see these details (and a UPI
 * QR) on their fees page and pay the school directly, so no money passes through ZAQSA.
 */
export const PUT = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...ROLES]);
  const b = Body.parse(await req.json());
  const data = {
    holderName: b.holderName,
    bankName: b.bankName,
    ifsc: b.ifsc,
    accountLast4: b.accountNumber.slice(-4),
    accountCipher: encryptSecret(b.accountNumber),
    upiId: b.upiId ?? null,
  };
  await prisma.$transaction([
    prisma.tenantBank.upsert({ where: { tenantId }, update: data, create: { tenantId, ...data } }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "school.payment_details",
        entity: "tenant",
        entityId: tenantId,
      },
    }),
  ]);
  return NextResponse.json({ ok: true });
});
