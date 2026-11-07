import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * ZAQSA team members sign in at the website editor (admin.zaqsa.com), not here. The two sites share
 * no cookies, so the editor hands this site a short-lived signed token after its own sign-in.
 * It is an HS256 JWT (header.payload.signature) signed with SSO_SHARED_SECRET (32+ characters, the
 * same value on both sites). SSO_ADMIN_URL is the editor's address; default https://admin.zaqsa.com.
 */
export const SSO_ISSUER = "zaqsa-admin";

const b64 = (v: Buffer | string) => Buffer.from(v).toString("base64url");

export const ssoSecret = () => {
  const s = process.env.SSO_SHARED_SECRET ?? "";
  return s.length >= 32 ? s : null;
};

export const adminOrigin = () =>
  new URL(process.env.SSO_ADMIN_URL ?? "https://admin.zaqsa.com").origin;

/**
 * On Vercel (production or preview) team members cannot use a password here at all: the editor is
 * the only way in. Local development and tests keep the password so they stay quick to run.
 */
export const platformPasswordAllowed = () =>
  process.env.VERCEL_ENV !== "production" && process.env.VERCEL_ENV !== "preview";

export interface SsoClaims {
  sub: string;
  email: string;
  name: string;
  /** The value this site generated for the attempt; it must come back unchanged. */
  state: string;
  /** The address the token is for, for example https://team.schools.zaqsa.com. */
  aud: string;
}

export function signToken(claims: SsoClaims, secret: string, now = Date.now(), ttl = 60): string {
  const iat = Math.floor(now / 1000);
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({ ...claims, iss: SSO_ISSUER, iat, exp: iat + ttl }));
  const sig = createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

/** The claims if the signature, issuer, audience and expiry are all right; otherwise null. */
export function verifyToken(
  token: string,
  secret: string,
  aud: string,
  now = Date.now(),
): (SsoClaims & { iat: number; exp: number }) | null {
  const [head, body, sig] = token.split(".");
  if (!head || !body || !sig) return null;
  try {
    if (JSON.parse(Buffer.from(head, "base64url").toString()).alg !== "HS256") return null;
    const want = createHmac("sha256", secret).update(`${head}.${body}`).digest();
    const got = Buffer.from(sig, "base64url");
    if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
    const c = JSON.parse(Buffer.from(body, "base64url").toString());
    if (c.iss !== SSO_ISSUER || c.aud !== aud) return null;
    if (typeof c.exp !== "number" || c.exp * 1000 < now) return null;
    if (typeof c.email !== "string" || typeof c.state !== "string") return null;
    return c;
  } catch {
    return null;
  }
}
