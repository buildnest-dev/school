import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/**
 * GET ?host=greenvalley.school.zaqsa.com: tells the front end which school an address belongs to
 * and which site to show (staff or parents). It reveals only the school's name and whether it is
 * open, so it is safe to call before sign-in.
 */
export const GET = handle(async (req: Request) => {
  const host = (new URL(req.url).searchParams.get("host") ?? "").toLowerCase().split(":")[0] ?? "";
  const base = process.env.ZAQSA_BASE_DOMAIN ?? "zaqsa.com";
  const m = new RegExp(`^([a-z0-9-]+)\\.(school|parents)\\.${base.replace(/\./g, "\\.")}$`).exec(
    host,
  );
  const notFound = NextResponse.json(
    { code: "not_found", message: "Unknown address." },
    { status: 404 },
  );
  if (!m) return notFound;
  const t = await prisma.tenant.findUnique({ where: { slug: m[1]! } });
  if (!t) return notFound;
  const kind = m[2] as "school" | "parents";
  return NextResponse.json({
    kind,
    slug: t.slug,
    name: t.name,
    // Families cannot sign in until the school is live; staff can while it is being set up.
    open: t.status === "live" || (kind === "school" && t.status === "provisioned"),
  });
});
