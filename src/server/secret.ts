import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Encrypts small secrets (such as a bank account number) with AES-256-GCM.
 * The key comes from BANK_ENC_KEY (any long random string). Production refuses to start without it;
 * development uses a fixed key so tests work, which is not safe for real data.
 */
function key() {
  const k = process.env.BANK_ENC_KEY;
  if (!k && process.env.NODE_ENV === "production")
    throw new Error("BANK_ENC_KEY must be set in production.");
  return createHash("sha256")
    .update(k ?? "development-only-key")
    .digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(packed: string) {
  const [iv, tag, data] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  if (!iv || !tag || !data) throw new Error("Bad secret format.");
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
