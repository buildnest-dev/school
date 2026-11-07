import { describe, expect, it } from "vitest";
import { allowedReturn, signToken, verifyToken } from "@/server/sso";

const secret = "x".repeat(40);
const claims = {
  sub: "u1",
  email: "a@b.c",
  name: "A",
  role: "super_admin",
  state: "s".repeat(20),
  aud: "https://admin.zaqsa.com",
};

describe("sso token", () => {
  it("round-trips and expires after a minute", () => {
    const t = signToken(claims, secret, 1_000_000);
    expect(verifyToken(t, secret, 1_030_000)?.email).toBe("a@b.c");
    expect(verifyToken(t, secret, 1_000_000 + 61_000)).toBeNull();
  });
  it("rejects a wrong secret or a tampered body", () => {
    const t = signToken(claims, secret);
    expect(verifyToken(t, "y".repeat(40))).toBeNull();
    const [h, , s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...claims, role: "x", iss: "zaqsa-team", exp: 9e9 })).toString("base64url");
    expect(verifyToken(`${h}.${forged}.${s}`, secret)).toBeNull();
  });
});

describe("allowed return addresses", () => {
  it("accepts only the admin site by default", () => {
    expect(allowedReturn("https://admin.zaqsa.com/auth/callback")).not.toBeNull();
    expect(allowedReturn("https://evil.example/auth/callback")).toBeNull();
    expect(allowedReturn("http://admin.zaqsa.com/auth/callback")).toBeNull();
    expect(allowedReturn("https://admin.zaqsa.com.evil.example/x")).toBeNull();
    expect(allowedReturn(null)).toBeNull();
  });
});
