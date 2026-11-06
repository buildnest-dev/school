import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, login } from "@/server/auth";
import { assertSameOrigin, clearThrottle, handle, throttle } from "@/server/http";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  school: z.string().optional(),
  /** 6-digit code from the authenticator app, for accounts that turned it on. */
  code: z.string().trim().optional(),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = Body.parse(await req.json());
  const key = `${body.email.toLowerCase()}|${req.headers.get("x-forwarded-for") ?? "local"}`;
  throttle(key);
  const ok = await login(body.email, body.password, body.school, body.code);
  if (ok === "mfa_required")
    throw new HttpError(401, "mfa_required", "Enter the 6-digit code from your authenticator app.");
  if (ok === "mfa_invalid")
    throw new HttpError(401, "mfa_invalid", "That code is not valid. Try the next one.");
  if (!ok) throw new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
  clearThrottle(key);
  return NextResponse.json({ ok: true });
});
