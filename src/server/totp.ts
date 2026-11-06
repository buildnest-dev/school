import { createHmac, randomBytes } from "node:crypto";

/** Time-based one-time passwords (RFC 6238) as used by Google Authenticator and similar apps. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP = 30;

export function base32Encode(buf: Buffer) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string) {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const c of text.replace(/=+$/, "").toUpperCase()) {
    const i = ALPHABET.indexOf(c);
    if (i < 0) throw new Error("Not base32.");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export const newSecret = () => base32Encode(randomBytes(20));

export function codeAt(secret: string, step: number) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  const n =
    ((h[o]! & 127) << 24) |
    ((h[o + 1]! & 255) << 16) |
    ((h[o + 2]! & 255) << 8) |
    (h[o + 3]! & 255);
  return String(n % 1_000_000).padStart(6, "0");
}

export const currentStep = (now = Date.now()) => Math.floor(now / 1000 / STEP);

/**
 * Returns the matching 30-second step (allowing one step either side for clock drift), or null.
 * The caller must refuse a step that is not newer than the last one used, so a code works once.
 */
export function verifyCode(secret: string, code: string, now = Date.now()) {
  if (!/^\d{6}$/.test(code)) return null;
  const cur = currentStep(now);
  for (const s of [cur, cur - 1, cur + 1]) if (codeAt(secret, s) === code) return s;
  return null;
}

export const otpauthUri = (secret: string, account: string) =>
  `otpauth://totp/ZAQSA:${encodeURIComponent(account)}?secret=${secret}&issuer=ZAQSA&digits=6&period=${STEP}`;
