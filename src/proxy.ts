import { NextResponse, type NextRequest } from "next/server";
import { classifyHost, pathAllowed } from "./server/hosts";

/**
 * Keeps each ZAQSA address to its own pages: the public site shows only the home page and the demo
 * form, the team address only the platform, a school address only staff and teachers, a parents
 * address only parents and students. Every address except the public one tells search engines
 * to stay away. Who may actually sign in on an address is checked again on the server.
 * Any other address (localhost, previews) is left alone.
 */
export function proxy(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const h = classifyHost(host);
  if (h.kind === "other") return NextResponse.next();

  const { pathname } = req.nextUrl;
  let res: NextResponse;
  if (pathAllowed(h, pathname)) res = NextResponse.next();
  else if (pathname.startsWith("/api/"))
    res = NextResponse.json({ code: "not_found", message: "Not found." }, { status: 404 });
  else res = NextResponse.redirect(new URL(h.kind === "public" ? "/" : "/sign-in", req.url));

  if (h.kind !== "public") res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return res;
}

export const config = {
  // Everything except static files (anything with a dot in its name) and the framework assets.
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
