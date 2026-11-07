import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { currentHost, startSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { ssoSecret, verifyToken } from "@/server/sso";

const fail = (req: Request) =>
  NextResponse.redirect(new URL("/sign-in?error=sso", req.url), { status: 303 });

/**
 * GET ?token&state: the website editor sends a signed team member back here. The state must match
 * the cookie set when the attempt began, the token must be fresh and made for this address, and the
 * email must belong to an active ZAQSA team account in this database. Anything else is refused.
 */
export async function GET(req: Request) {
  const host = await currentHost();
  const secret = ssoSecret();
  if (host.kind !== "team" || !secret) return fail(req);

  const q = new URL(req.url).searchParams;
  const jar = await cookies();
  const saved = jar.get("sso_state")?.value ?? "";
  jar.delete({ name: "sso_state", path: "/api/platform/sso" });
  const state = q.get("state") ?? "";
  const a = Buffer.from(saved);
  const b = Buffer.from(state);
  if (!saved || a.length !== b.length || !timingSafeEqual(a, b)) return fail(req);

  const claims = verifyToken(q.get("token") ?? "", secret, new URL(req.url).origin);
  if (!claims || claims.state !== saved) return fail(req);

  const user = await prisma.user.findUnique({
    where: { email: claims.email.trim().toLowerCase() },
    select: { id: true, active: true, isPlatformAdmin: true },
  });
  if (!user || !user.active || !user.isPlatformAdmin) return fail(req);

  await startSession(user.id, null);
  return NextResponse.redirect(new URL("/platform", req.url), { status: 303 });
}
