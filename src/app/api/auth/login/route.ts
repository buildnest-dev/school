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
  /** Team members: keep this browser signed in without asking for a code for 30 days. */
  remember: z.boolean().optional(),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const body = Body.parse(await req.json());
  const key = `${body.email.toLowerCase()}|${req.headers.get("x-forwarded-for") ?? "local"}`;
  await throttle(key);
  const ok = await login(body.email, body.password, body.school, body.code, body.remember);
  if (ok === "mfa_required")
    throw new HttpError(401, "mfa_required", "Enter the 6-digit code from your authenticator app.");
  if (ok === "mfa_invalid")
    throw new HttpError(401, "mfa_invalid", "That code is not valid. Try the next one.");
  if (ok === "approval_required")
    throw new HttpError(
      401,
      "approval_required",
      "Request sent. Ask a ZAQSA admin to approve it at admin.zaqsa.com, then enter the code they give you.",
    );
  if (typeof ok === "string" && ok.startsWith("approval_cooldown:"))
    throw new HttpError(
      429,
      "approval_cooldown",
      `That request was not approved. Try again in ${ok.split(":")[1]} minute(s).`,
    );
  if (ok === "approval_invalid")
    throw new HttpError(401, "approval_invalid", "That code is not valid or has expired. Start again.");
  if (!ok) throw new HttpError(401, "invalid_credentials", "Email or password is incorrect.");
  await clearThrottle(key);
  return NextResponse.json({ ok: true });
});
