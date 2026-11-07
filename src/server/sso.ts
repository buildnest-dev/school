import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Lets another ZAQSA site (the website editor at admin.zaqsa.com) trust a sign-in done here.
 * The two sites share no cookies, so after a platform user signs in on the team address we hand
 * the other site a short-lived signed token. It is an HS256 JWT: header.payload.signature.
 * Needs SSO_SHARED_SECRET (32+ characters, the same value on both sites).
 * SSO_ALLOWED_RETURNS (comma separated origins) says where tokens may be sent; default is admin.zaqsa.com.
 */
export const SSO_TTL_SECONDS = 60;

const b64 = (v: Buffer | string) => Buffer.from(v).toString("base64url");

export const ssoSecret = () => {
  const s = process.env.SSO_SHARED_SECRET ?? "";
  return s.length >= 32 ? s : null;
};

/** The origin a token may go to, or null when the return address is not on the allow-list. */
export function allowedReturn(raw: string | null): URL | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) return null;
  const allowed = (process.env.SSO_ALLOWED_RETURNS ?? "https://admin.zaqsa.com")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return allowed.includes(url.origin) ? url : null;
}

export interface SsoClaims {
  sub: string;
  email: string;
  name: string;
  /** The person's ZAQSA team role, for example super_admin or marketing. */
  role: string;
  /** The value the other site generated for this attempt; it checks it comes back unchanged. */
  state: string;
  aud: string;
}

export function signToken(claims: SsoClaims, secret: string, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(
    JSON.stringify({ ...claims, iss: "zaqsa-team", iat, exp: iat + SSO_TTL_SECONDS }),
  );
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** Used by tests and as the reference for the other site. Returns the claims, or null if invalid or expired. */
export function verifyToken(
  token: string,
  secret: string,
  now = Date.now(),
): (SsoClaims & { iss: string; iat: number; exp: number }) | null {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  const want = createHmac("sha256", secret).update(`${head}.${body}`).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString());
    if (c.iss !== "zaqsa-team" || typeof c.exp !== "number" || c.exp * 1000 < now) return null;
    return c;
  } catch {
    return null;
  }
}
