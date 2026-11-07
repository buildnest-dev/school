/**
 * Which ZAQSA address a request came to, and who may use it. Plain functions with no database or
 * Node imports, so the proxy and the server share one definition.
 *
 *   school.<base>                  public product site and the demo request form
 *   team.schools.<base>            the ZAQSA team (platform users only)
 *   <slug>.school.<base>           one school's staff and teachers
 *   <slug>.parents.<base>          that school's parents and students
 *
 * Any other address (localhost, a Vercel preview address, a test run) is "other" and keeps the
 * old behaviour: the role in the session decides what is shown.
 */
export type HostInfo =
  | { kind: "public" }
  | { kind: "team" }
  | { kind: "school"; slug: string }
  | { kind: "parents"; slug: string }
  | { kind: "other" };

/** Names a school may not take, because they are used by ZAQSA itself. */
export const RESERVED_SLUGS = new Set([
  "team",
  "schools",
  "school",
  "parents",
  "admin",
  "www",
  "api",
  "app",
  "mail",
  "static",
  "support",
  "help",
  "billing",
  "status",
  "demo",
  "test",
]);

export const baseDomain = () => (process.env.ZAQSA_BASE_DOMAIN ?? "zaqsa.com").toLowerCase();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function classifyHost(rawHost: string | null | undefined, base = baseDomain()): HostInfo {
  const host = (rawHost ?? "").toLowerCase().split(",")[0]!.trim().split(":")[0]!;
  if (!host) return { kind: "other" };
  if (host === `school.${base}`) return { kind: "public" };
  if (host === `team.schools.${base}`) return { kind: "team" };
  const m = new RegExp(`^([a-z0-9-]+)\\.(school|parents)\\.${escape(base)}$`).exec(host);
  if (m) {
    const slug = m[1]!;
    // A reserved word is never a school, so an address like team.school.<base> is not one.
    if (RESERVED_SLUGS.has(slug)) return { kind: "other" };
    return m[2] === "school" ? { kind: "school", slug } : { kind: "parents", slug };
  }
  return { kind: "other" };
}

const FAMILY = new Set(["parent", "student"]);

export type Who = { platform: true } | { platform: false; role: string; slug: string };

/** May this person use this address? The session's school must be the address's school. */
export function hostAllows(h: HostInfo, who: Who): boolean {
  switch (h.kind) {
    case "other":
      return true;
    case "public":
      return false; // the public site has no sign-in
    case "team":
      return who.platform;
    case "school":
      return !who.platform && !FAMILY.has(who.role) && who.slug === h.slug;
    case "parents":
      return !who.platform && FAMILY.has(who.role) && who.slug === h.slug;
  }
}

/** Where each address's pages live. Anything outside is sent back to the sign-in page (or home). */
export function pathAllowed(h: HostInfo, pathname: string): boolean {
  const first = "/" + (pathname.split("/")[1] ?? "");
  if (["/_next", "/robots.txt", "/favicon.ico"].includes(first)) return true;
  if (first === "/sign-in") return h.kind !== "public";
  if (first === "/api")
    return h.kind !== "public" || pathname === "/api/public" || pathname.startsWith("/api/public/");
  switch (h.kind) {
    case "other":
      return true;
    case "public":
      return pathname === "/" || ["/get-started", "/placeholder"].includes(first);
    case "team":
      return first === "/platform";
    case "school":
      return first === "/school" || first === "/teacher";
    case "parents":
      return first === "/parent" || first === "/student";
  }
}
