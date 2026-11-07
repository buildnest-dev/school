import { describe, expect, it } from "vitest";
import { cooldownMinutes, hashCode, type ApprovalRequest } from "@/server/approvals";

const req = (status: string, decidedAgoMs?: number): ApprovalRequest => ({
  id: "r",
  status,
  attempts: 0,
  createdAt: new Date(),
  decidedAt: decidedAgoMs === undefined ? undefined : new Date(Date.now() - decidedAgoMs),
});

describe("team sign-in approval", () => {
  it("hashes the code the way the admin site does", () => {
    expect(hashCode("req123", "482913")).toBe(
      "07f3038d83bea185157dc82278fd322191825d640d9b636f86a60ebc1bd58ec6",
    );
  });

  it("makes a person wait five minutes after a rejection or lock", () => {
    expect(cooldownMinutes([])).toBe(0);
    expect(cooldownMinutes([req("pending")])).toBe(0);
    expect(cooldownMinutes([req("approved", 1000)])).toBe(0);
    expect(cooldownMinutes([req("denied", 60_000)])).toBe(4);
    expect(cooldownMinutes([req("rejected", 1000)])).toBe(5);
    expect(cooldownMinutes([req("locked", 120_000)])).toBe(3);
    expect(cooldownMinutes([req("denied", 6 * 60_000)])).toBe(0);
  });
});
