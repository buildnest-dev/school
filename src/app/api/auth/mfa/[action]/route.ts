import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { decryptSecret, encryptSecret } from "@/server/secret";
import { newSecret, otpauthUri, verifyCode } from "@/server/totp";

const Code = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});
const Disable = Code.extend({ password: z.string().min(1) });

/**
 * Authenticator-app sign-in for the signed-in user.
 *   POST /api/auth/mfa/setup    -> secret and otpauth link to add to the app (not active yet)
 *   POST /api/auth/mfa/enable   -> { code }  turns it on once a correct code is shown
 *   POST /api/auth/mfa/disable  -> { code, password }  turns it off
 * The secret is stored encrypted. Privileged accounts (platform admin, owner, principal) should use it.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ action: string }> }) => {
  assertSameOrigin(req);
  const { action } = await ctx.params;
  const { user } = await requireAuth(undefined, { mfaExempt: true });
  await throttle(`mfa|${user.id}`, 10, 10 * 60_000);
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });

  if (action === "setup") {
    if (row.totpEnabled)
      throw new HttpError(409, "already_on", "Authenticator sign-in is already on.");
    const secret = newSecret();
    await prisma.user.update({
      where: { id: row.id },
      data: { totpCipher: encryptSecret(secret) },
    });
    return NextResponse.json({ ok: true, secret, otpauth: otpauthUri(secret, row.email) });
  }

  if (action === "enable") {
    const { code } = Code.parse(await req.json());
    if (row.totpEnabled)
      throw new HttpError(409, "already_on", "Authenticator sign-in is already on.");
    if (!row.totpCipher) throw new HttpError(409, "no_setup", "Start the setup first.");
    const step = verifyCode(decryptSecret(row.totpCipher), code);
    if (step === null) throw new HttpError(422, "mfa_invalid", "That code is not valid.");
    await prisma.user.update({
      where: { id: row.id },
      data: { totpEnabled: true, totpLastStep: step },
    });
    return NextResponse.json({ ok: true, message: "Authenticator sign-in is on." });
  }

  if (action === "disable") {
    const b = Disable.parse(await req.json());
    if (!row.totpEnabled || !row.totpCipher)
      throw new HttpError(409, "not_on", "Authenticator sign-in is not on.");
    if (!(await bcrypt.compare(b.password, row.passwordHash)))
      throw new HttpError(403, "wrong_password", "Password is incorrect.");
    const step = verifyCode(decryptSecret(row.totpCipher), b.code);
    // The password is also required here, so a code that was just used to sign in may be reused once.
    if (step === null || step < row.totpLastStep)
      throw new HttpError(422, "mfa_invalid", "That code is not valid.");
    await prisma.user.update({
      where: { id: row.id },
      data: { totpEnabled: false, totpCipher: null, totpLastStep: 0 },
    });
    return NextResponse.json({ ok: true, message: "Authenticator sign-in is off." });
  }
  throw new HttpError(404, "not_found", "Not found.");
});
