import { describe, expect, it } from "vitest";
import { classifyHost, hostAllows, pathAllowed } from "../src/server/hosts";

const B = "zaqsa.com";
const c = (h: string) => classifyHost(h, B);

describe("classifyHost", () => {
  it("knows the public, team, school and parents addresses", () => {
    expect(c("school.zaqsa.com")).toEqual({ kind: "public" });
    expect(c("team.schools.zaqsa.com")).toEqual({ kind: "team" });
    expect(c("greenvalley.school.zaqsa.com")).toEqual({ kind: "school", slug: "greenvalley" });
    expect(c("greenvalley.parents.zaqsa.com")).toEqual({ kind: "parents", slug: "greenvalley" });
  });
  it("ignores case, ports and a forwarded list", () => {
    expect(c("GreenValley.School.ZAQSA.com:443")).toEqual({ kind: "school", slug: "greenvalley" });
    expect(c("a.school.zaqsa.com, evil.com")).toEqual({ kind: "school", slug: "a" });
  });
  it("never treats reserved words as a school", () => {
    for (const w of [
      "team",
      "schools",
      "school",
      "parents",
      "admin",
      "www",
      "api",
      "app",
      "mail",
    ]) {
      expect(c(`${w}.school.zaqsa.com`)).toEqual({ kind: "other" });
      expect(c(`${w}.parents.zaqsa.com`)).toEqual({ kind: "other" });
    }
  });
  it("leaves every other address alone", () => {
    for (const h of [
      "localhost:3000",
      "x.vercel.app",
      "admin.zaqsa.com",
      "a.b.school.zaqsa.com",
      "school.zaqsa.com.evil.com",
      "",
    ])
      expect(c(h).kind).toBe("other");
  });
});

describe("hostAllows", () => {
  const staff = { platform: false, role: "principal", slug: "gv" } as const;
  const teacher = { platform: false, role: "teacher", slug: "gv" } as const;
  const parent = { platform: false, role: "parent", slug: "gv" } as const;
  const student = { platform: false, role: "student", slug: "gv" } as const;
  const team = { platform: true } as const;

  it("team address: platform users only", () => {
    expect(hostAllows({ kind: "team" }, team)).toBe(true);
    for (const w of [staff, teacher, parent, student])
      expect(hostAllows({ kind: "team" }, w)).toBe(false);
  });
  it("school address: staff and teachers of that school only", () => {
    const h = { kind: "school", slug: "gv" } as const;
    expect(hostAllows(h, staff)).toBe(true);
    expect(hostAllows(h, teacher)).toBe(true);
    expect(hostAllows(h, parent)).toBe(false);
    expect(hostAllows(h, student)).toBe(false);
    expect(hostAllows(h, team)).toBe(false);
    expect(hostAllows(h, { ...staff, slug: "other" })).toBe(false);
  });
  it("parents address: parents and students of that school only", () => {
    const h = { kind: "parents", slug: "gv" } as const;
    expect(hostAllows(h, parent)).toBe(true);
    expect(hostAllows(h, student)).toBe(true);
    expect(hostAllows(h, staff)).toBe(false);
    expect(hostAllows(h, teacher)).toBe(false);
    expect(hostAllows(h, team)).toBe(false);
    expect(hostAllows(h, { ...parent, slug: "other" })).toBe(false);
  });
  it("public address has no sign-in; other addresses allow all", () => {
    expect(hostAllows({ kind: "public" }, team)).toBe(false);
    expect(hostAllows({ kind: "public" }, staff)).toBe(false);
    expect(hostAllows({ kind: "other" }, staff)).toBe(true);
  });
});

describe("pathAllowed", () => {
  it("public address: home, get-started and the public API only", () => {
    const h = { kind: "public" } as const;
    expect(pathAllowed(h, "/")).toBe(true);
    expect(pathAllowed(h, "/get-started")).toBe(true);
    expect(pathAllowed(h, "/api/public/leads")).toBe(true);
    expect(pathAllowed(h, "/sign-in")).toBe(false);
    expect(pathAllowed(h, "/platform")).toBe(false);
    expect(pathAllowed(h, "/school")).toBe(false);
    expect(pathAllowed(h, "/api/auth/login")).toBe(false);
    expect(pathAllowed(h, "/api/students")).toBe(false);
    expect(pathAllowed(h, "/api/publicity")).toBe(false);
  });
  it("each signed-in address keeps to its own areas", () => {
    for (const h of [
      { kind: "team" },
      { kind: "school", slug: "a" },
      { kind: "parents", slug: "a" },
    ] as const) {
      expect(pathAllowed(h, "/reset-password")).toBe(true);
      expect(pathAllowed(h, "/forgot-password")).toBe(true);
    }
    expect(pathAllowed({ kind: "public" }, "/reset-password")).toBe(false);
    expect(pathAllowed({ kind: "team" }, "/platform/schools")).toBe(true);
    expect(pathAllowed({ kind: "team" }, "/school")).toBe(false);
    expect(pathAllowed({ kind: "school", slug: "a" }, "/teacher")).toBe(true);
    expect(pathAllowed({ kind: "school", slug: "a" }, "/parent")).toBe(false);
    expect(pathAllowed({ kind: "school", slug: "a" }, "/platform")).toBe(false);
    expect(pathAllowed({ kind: "parents", slug: "a" }, "/student")).toBe(true);
    expect(pathAllowed({ kind: "parents", slug: "a" }, "/school")).toBe(false);
    expect(pathAllowed({ kind: "parents", slug: "a" }, "/api/me")).toBe(true);
  });
});
