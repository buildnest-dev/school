import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { encryptSecret } from "@/server/secret";
import { personName } from "@/server/validators";

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
});

/** PUT: stores the payout account. The number is kept encrypted and is never returned again. */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requireAuth(["platform_admin"]);
  const { id } = await ctx.params;
  if (!(await prisma.tenant.findUnique({ where: { id } })))
    throw new HttpError(404, "not_found", "School not found.");
  const b = Body.parse(await req.json());
  const data = {
    holderName: b.holderName,
    bankName: b.bankName,
    ifsc: b.ifsc,
    accountLast4: b.accountNumber.slice(-4),
    accountCipher: encryptSecret(b.accountNumber),
  };
  await prisma.$transaction([
    prisma.tenantBank.upsert({
      where: { tenantId: id },
      update: data,
      create: { tenantId: id, ...data },
    }),
    prisma.auditLog.create({
      data: {
        tenantId: id,
        userId: user.id,
        action: "school.bank",
        entity: "tenant",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", accountMasked: `XXXXXX${data.accountLast4}` });
});
