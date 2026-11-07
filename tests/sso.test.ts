import { describe, expect, it } from "vitest";
import { signToken, verifyToken } from "@/server/sso";

const secret = "x".repeat(40);
const aud = "https://team.schools.zaqsa.com";
const claims = { sub: "u1", email: "a@b.c", name: "A", state: "s".repeat(20), aud };

describe("sso token", () => {
  it("round-trips and expires after a minute", () => {
    const t = signToken(claims, secret, 1_000_000);
    expect(verifyToken(t, secret, aud, 1_030_000)?.email).toBe("a@b.c");
    expect(verifyToken(t, secret, aud, 1_000_000 + 61_000)).toBeNull();
  });
  it("rejects a wrong secret, wrong audience or tampered body", () => {
    const t = signToken(claims, secret);
    expect(verifyToken(t, "y".repeat(40), aud)).toBeNull();
    expect(verifyToken(t, secret, "https://admin.zaqsa.com")).toBeNull();
    const [h, , s] = t.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...claims, email: "x@y.z", iss: "zaqsa-admin", exp: 9e9 }),
    ).toString("base64url");
    expect(verifyToken(`${h}.${forged}.${s}`, secret, aud)).toBeNull();
  });
  it("rejects an unsigned token", () => {
    const h = Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url");
    const b = Buffer.from(JSON.stringify({ ...claims, iss: "zaqsa-admin", exp: 9e9 })).toString("base64url");
    expect(verifyToken(`${h}.${b}.`, secret, aud)).toBeNull();
  });
});
