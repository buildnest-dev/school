import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentHost } from "@/server/auth";
import { adminOrigin, ssoSecret } from "@/server/sso";

const STATE_COOKIE = "sso_state";

/**
 * GET: start a team sign-in. Sends the visitor to the website editor, which signs them in and
 * sends them back to /api/platform/sso/callback with a signed token. Only on the team address.
 */
export async function GET(req: Request) {
  const host = await currentHost();
  if (host.kind !== "team" || !ssoSecret())
    return NextResponse.json(
      { error: { code: "not_found", message: "Not found." } },
      { status: host.kind === "team" ? 503 : 404 },
    );
  const state = randomBytes(32).toString("base64url");
  (await cookies()).set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/platform/sso",
    maxAge: 600,
  });
  const origin = new URL(req.url).origin;
  const to = new URL("/sso/team", adminOrigin());
  to.searchParams.set("return", `${origin}/api/platform/sso/callback`);
  to.searchParams.set("state", state);
  return NextResponse.redirect(to);
}
