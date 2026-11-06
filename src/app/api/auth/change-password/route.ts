import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { strongPassword } from "@/server/accounts";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";

const Body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: strongPassword });

/** Signed-in password change. Needs the current password; other devices are signed out. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { user, sessionId } = await requireAuth();
  await throttle(`chpw|${user.id}`, 5, 10 * 60_000);
  const b = Body.parse(await req.json());
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  if (!(await bcrypt.compare(b.currentPassword, row.passwordHash)))
    throw new HttpError(403, "wrong_password", "The current password is not correct.");
  if (b.newPassword === b.currentPassword)
    throw new HttpError(422, "same_password", "Choose a different password.");
  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(b.newPassword, 10) },
    }),
    prisma.session.deleteMany({ where: { userId: user.id, id: { not: sessionId } } }),
  ]);
  return NextResponse.json({ ok: true, message: "Password changed." });
});
