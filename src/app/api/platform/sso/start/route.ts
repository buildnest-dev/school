import { NextResponse } from "next/server";
import { getAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { allowedReturn, signToken, ssoSecret } from "@/server/sso";

/**
 * GET ?return=<callback address>&state=<random value>: sign-in for the website editor.
 * A ZAQSA team member who is signed in here (password and authenticator code) is sent back to the
 * editor with a one-minute signed token. Anyone else is sent to the sign-in page first.
 * Tokens only ever go to addresses on the allow-list, and only team accounts can get one.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = allowedReturn(url.searchParams.get("return"));
  const state = url.searchParams.get("state") ?? "";
  const secret = ssoSecret();
  if (!back || state.length < 16 || state.length > 200)
    return NextResponse.json(
      { error: { code: "bad_request", message: "Not a valid sign-in request." } },
      { status: 400 },
    );
  if (!secret)
    return NextResponse.json(
      { error: { code: "not_configured", message: "Website editor sign-in is not switched on." } },
      { status: 503 },
    );

  const a = await getAuth();
  if (!a || a.user.role !== "platform_admin") {
    const next = `/api/platform/sso/start${url.search}`;
    return NextResponse.redirect(new URL(`/sign-in?next=${encodeURIComponent(next)}`, req.url));
  }
  // A team account must finish turning on the authenticator app before it can open anything else.
  if (a.mfaSetupRequired) return NextResponse.redirect(new URL("/platform", req.url));

  const u = await prisma.user.findUniqueOrThrow({
    where: { id: a.user.id },
    select: { email: true, name: true, platformRole: true, active: true },
  });
  if (!u.active) return NextResponse.redirect(new URL("/sign-in", req.url));

  const token = signToken(
    {
      sub: a.user.id,
      email: u.email,
      name: u.name,
      role: u.platformRole ?? "super_admin",
      state,
      aud: back.origin,
    },
    secret,
  );
  back.searchParams.set("token", token);
  back.searchParams.set("state", state);
  const res = NextResponse.redirect(back);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
