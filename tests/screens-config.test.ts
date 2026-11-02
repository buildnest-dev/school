import { describe, expect, it } from "vitest";
import { ROLE_AREA, SCREENS, matchScreen, screenHref, staticSlugs } from "@/config/screens";
import { SCREEN_COMPONENTS } from "@/features/registry";
import { NAV_ICONS } from "@/components/layout/nav-icons";
import { validateMark } from "@/features/teacher/schemas";

describe("screen inventory (config/screens.ts)", () => {
  it("has unique ids and unique paths within an area", () => {
    const ids = SCREENS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = SCREENS.map((s) => `${s.area}/${s.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only lets roles into the area they belong to", () => {
    for (const s of SCREENS)
      for (const r of s.roles) expect(ROLE_AREA[r], `${s.id} → ${r}`).toBe(s.area);
  });

  it("every implemented or partial screen has a component; planned ones do not pretend to", () => {
    for (const s of SCREENS) {
      if (s.status === "planned") expect(SCREEN_COMPONENTS[s.id], s.id).toBeUndefined();
      else expect(SCREEN_COMPONENTS[s.id], s.id).toBeDefined();
    }
  });

  it("uses only known sidebar icons", () => {
    for (const s of SCREENS)
      if (s.nav) expect(NAV_ICONS[s.nav.icon], `${s.id}: ${s.nav.icon}`).toBeDefined();
  });

  it("matches static and dynamic paths", () => {
    expect(matchScreen("teacher", [])?.screen.id).toBe("teacher-home");
    expect(matchScreen("teacher", ["attendance", "8A"])?.params.classId).toBe("8A");
    expect(matchScreen("school", ["students", "st-001"])?.screen.id).toBe("school-student-detail");
    expect(matchScreen("school", ["nope"])).toBeNull();
    expect(screenHref(SCREENS.find((s) => s.id === "school-home")!)).toBe("/school");
  });

  it("pre-renders only non-dynamic paths", () => {
    expect(staticSlugs("school").every((slug) => !slug.some((p) => p.startsWith(":")))).toBe(true);
  });
});

describe("validateMark", () => {
  it("allows empty (not entered yet) and valid numbers", () => {
    expect(validateMark("", 50)).toBeNull();
    expect(validateMark("38", 50)).toBeNull();
    expect(validateMark("38.5", 50)).toBeNull();
  });
  it("rejects invalid input with a plain message", () => {
    expect(validateMark("abc", 50)).toMatch(/number/);
    expect(validateMark("51", 50)).toMatch(/more than 50/);
    expect(validateMark("-1", 50)).not.toBeNull();
  });
});
