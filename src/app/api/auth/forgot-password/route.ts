import { NextResponse } from "next/server";
import { z } from "zod";
import { createToken, originOf, sendMail } from "@/server/accounts";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";

const Body = z.object({ email: z.string().trim().toLowerCase().email() });

/**
 * "I forgot my password". The answer is always the same whether or not the e-mail has an
 * account, so it cannot be used to find out who is registered. Limited per address and per client.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { email } = Body.parse(await req.json());
  throttle(`forgot-ip|${req.headers.get("x-forwarded-for") ?? "local"}`, 10, 10 * 60_000);
  throttle(`forgot|${email}`, 3, 60 * 60_000);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.active) {
    const token = await createToken(user.id, "reset", 1);
    await sendMail({
      to: email,
      subject: "Reset your password",
      body: `Someone asked to reset your password. If it was you, choose a new one here (valid for 1 hour):\n${originOf(req)}/reset-password?token=${token}\n\nIf it was not you, ignore this message.\n`,
    });
  }
  return NextResponse.json({
    ok: true,
    message: "If that e-mail has an account, a reset link is on its way.",
  });
});
