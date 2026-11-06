import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, codeAt, verifyCode } from "../src/server/totp";
import { netAfter } from "../src/server/fees";

// RFC 6238 test secret: the ASCII string "12345678901234567890".
const SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("totp", () => {
  it("matches the RFC 6238 vector (time 59s gives ...287082 with 6 digits)", () => {
    expect(SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(codeAt(SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(codeAt(SECRET, Math.floor(1111111109 / 30))).toBe("081804");
  });

  it("round-trips base32", () => {
    const raw = Buffer.from([1, 2, 3, 250, 251, 252, 0, 9]);
    expect(base32Decode(base32Encode(raw))).toEqual(raw);
  });

  it("accepts one step of drift and rejects bad codes", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    expect(verifyCode(SECRET, codeAt(SECRET, step), now)).toBe(step);
    expect(verifyCode(SECRET, codeAt(SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyCode(SECRET, codeAt(SECRET, step - 3), now)).toBeNull();
    expect(verifyCode(SECRET, "abcdef", now)).toBeNull();
    expect(verifyCode(SECRET, "12345", now)).toBeNull();
  });
});

describe("netAfter", () => {
  it("takes percentages off one after another and rounds to paise", () => {
    expect(netAfter(100_000, [])).toBe(100_000);
    expect(netAfter(100_000, [10])).toBe(90_000);
    expect(netAfter(100_000, [10, 10])).toBe(81_000);
    expect(netAfter(333, [50])).toBe(167); // 166.5 rounds up
    expect(netAfter(100_000, [100])).toBe(0);
  });
});

import { brevoRequest } from "../src/server/accounts";

describe("brevoRequest", () => {
  const m = { to: "a@b.example", subject: "Hi", body: "Hello" };
  it("is off without a key or a sender", () => {
    expect(brevoRequest(m, {})).toBeNull();
    expect(brevoRequest(m, { BREVO_API_KEY: "k" })).toBeNull();
  });
  it("builds the Brevo transactional request", () => {
    const r = brevoRequest(m, { BREVO_API_KEY: "k", MAIL_FROM: "no-reply@zaqsa.com" })!;
    expect(r.url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(r.init.headers["api-key"]).toBe("k");
    expect(JSON.parse(r.init.body)).toEqual({
      sender: { name: "ZAQSA", email: "no-reply@zaqsa.com" },
      to: [{ email: "a@b.example" }],
      subject: "Hi",
      textContent: "Hello",
    });
  });
});
