import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { hashToken, strongPassword } from "@/server/accounts";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";

const Body = z.object({ token: z.string().min(20).max(100), password: strongPassword });

/**
 * Sets a new password from an e-mailed link (reset or first-time invite). A link works once and
 * expires; using it signs the person out everywhere else.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  // Only failed attempts count towards the limit, so ordinary successful use is never blocked.
  const failed = async () =>
    await throttle(`reset|${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 10 * 60_000);
  const { token, password } = Body.parse(await req.json());
  const bad = new HttpError(400, "bad_token", "This link is invalid or has expired.");
  const row = await prisma.passwordToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date() || !row.user.active) {
    await failed();
    throw bad;
  }
  // The password must not contain a recognisable piece of the e-mail name (e.g. "anita" in anita.j@...).
  const pieces = row.user.email
    .split("@")[0]!
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((x) => x.length >= 4);
  if (pieces.some((x) => password.toLowerCase().includes(x))) {
    await failed();
    throw new HttpError(422, "weak_password", "The password must not contain your e-mail name.");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    // Claim the link first so two simultaneous uses cannot both succeed.
    const claim = await tx.passwordToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claim.count !== 1) throw bad;
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: row.userId } });
    await tx.trustedDevice.deleteMany({ where: { userId: row.userId } });
    await tx.passwordToken.updateMany({
      where: { userId: row.userId, usedAt: null },
      data: { usedAt: new Date() },
    });
  });
  return NextResponse.json({ ok: true, message: "Password saved. You can sign in now." });
});
