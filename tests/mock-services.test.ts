import { describe, expect, it } from "vitest";
import { createMockServices } from "@/services/mock";

describe("mock adapter (development only)", () => {
  it("searches, filters, sorts and paginates", async () => {
    const s = createMockServices();
    const all = await s.resource("students").list({ pageSize: 100 });
    expect(all.total).toBe(60);
    const page2 = await s.resource("students").list({ pageSize: 10, page: 2 });
    expect(page2.items).toHaveLength(10);
    expect(page2.page).toBe(2);
    const sorted = await s
      .resource("students")
      .list({ sort: "attendancePct", order: "asc", pageSize: 5 });
    const pcts = sorted.items.map((i) => i.attendancePct);
    expect([...pcts].sort((a, b) => a - b)).toEqual(pcts);
    const overdue = await s
      .resource("students")
      .list({ filters: { feeStatus: "overdue" }, pageSize: 100 });
    expect(overdue.items.every((i) => i.feeStatus === "overdue")).toBe(true);
    const found = await s.resource("students").list({ q: "zzzz-no-match" });
    expect(found.total).toBe(0);
  });

  it("labels every write as a mock", async () => {
    const s = createMockServices();
    const res = await s.attendance.save("8A", "2026-10-26", { "8A-01": "absent" }, true);
    expect(res.mode).toBe("mock");
    const sheet = await s.attendance.getSheet("8A", "2026-10-26");
    expect(sheet?.status).toBe("submitted");
    expect(sheet?.marks["8A-01"]).toBe("absent");
  });

  it("keeps marks as a draft until submitted", async () => {
    const s = createMockServices();
    await s.marks.save("6A", { "6A-01": 40, "6A-02": null }, false);
    expect((await s.marks.getSheet("6A"))?.status).toBe("draft");
    await s.marks.save("6A", { "6A-01": 40, "6A-02": 30 }, true);
    expect((await s.marks.getSheet("6A"))?.status).toBe("submitted");
  });

  it("cannot execute a rollover: it only reports it is awaiting the backend", async () => {
    const s = createMockServices();
    const r = await s.rollover.submit({
      rules: { minAttendancePct: 75, minOverallPct: 40, conditionalPromotion: true },
      acknowledgedWarnings: true,
      confirmText: "ROLLOVER 2026-27",
    });
    expect(r.state).toBe("awaiting_backend_authorization");
    expect(r.mode).toBe("mock");
  });

  it("applies promotion rules in the preview", async () => {
    const s = createMockServices();
    const strict = await s.rollover.preview({
      minAttendancePct: 95,
      minOverallPct: 80,
      conditionalPromotion: false,
    });
    const lenient = await s.rollover.preview({
      minAttendancePct: 0,
      minOverallPct: 0,
      conditionalPromotion: false,
    });
    expect(lenient.every((r) => r.outcome === "promote")).toBe(true);
    expect(strict.some((r) => r.outcome !== "promote")).toBe(true);
  });

  it("verifies only active certificates", async () => {
    const s = createMockServices();
    expect((await s.certificates.verify("NA/BON/2026/0142")).valid).toBe(true);
    expect((await s.certificates.verify("NA/BON/2026/0121")).valid).toBe(false); // cancelled
    expect((await s.certificates.verify("nope")).valid).toBe(false);
  });
});
