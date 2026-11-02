import { describe, expect, it } from "vitest";
import { demoRequestSchema } from "@/lib/schemas";
import { cn, clamp } from "@/lib/utils";

describe("demoRequestSchema", () => {
  const valid = {
    name: "Asha Rao",
    email: "asha@example.org",
    school: "Northfield Academy",
    role: "Owner / committee",
  };

  it("accepts a complete request", () => {
    expect(demoRequestSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a bad email and empty names with friendly messages", () => {
    const result = demoRequestSchema.safeParse({ ...valid, name: "", email: "nope", school: " " });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message);
      expect(messages).toContain("Please enter a valid email address.");
      expect(messages).toContain("Please enter your name.");
      expect(messages).toContain("Please enter your school or group name.");
    }
  });

  it("rejects an unknown role", () => {
    expect(demoRequestSchema.safeParse({ ...valid, role: "Hacker" }).success).toBe(false);
  });
});

describe("utils", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4", false && "hidden")).toBe("px-4");
  });
  it("clamps", () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
  });
});
