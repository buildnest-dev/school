import { describe, expect, it } from "vitest";
import { FEATURES, featureOfPath, linkOn, screenOn } from "@/config/features";
import { MODULES } from "@/config/modules";
import { SCREENS } from "@/config/screens";

describe("feature switches", () => {
  const screens = FEATURES.flatMap((f) => f.screens);

  it("name only real screens, each under one feature, with unique keys", () => {
    for (const id of screens)
      expect(
        SCREENS.some((s) => s.id === id),
        id,
      ).toBe(true);
    expect(new Set(screens).size).toBe(screens.length);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(FEATURES.length);
  });

  it("give every register a switch", () => {
    for (const m of MODULES) expect(featureOfPath(`/records/${m.key}`), m.key).toBeDefined();
  });

  it("match server paths and leave the always-included parts alone", () => {
    expect(featureOfPath("/transport/routes")).toBe("transport");
    expect(featureOfPath("/me/children/abc/ledger")).toBe("fees");
    expect(featureOfPath("/students/abc/documents")).toBe("documents");
    expect(featureOfPath("/staff/leave-requests")).toBe("leave");
    expect(featureOfPath("/homework-submissions")).toBe("homework");
    for (const p of [
      "/students",
      "/students/abc",
      "/staff",
      "/notices",
      "/me",
      "/records",
      "/classes",
    ])
      expect(featureOfPath(p), p).toBeUndefined();
  });

  it("hide screens and links of a switched-off feature only", () => {
    const off = ["library", "attendance"];
    expect(screenOn("school-library", off)).toBe(false);
    expect(screenOn("school-students", off)).toBe(true);
    expect(linkOn("/teacher/attendance/abc", off)).toBe(false);
    expect(linkOn("/school/fees", off)).toBe(true);
  });
});
