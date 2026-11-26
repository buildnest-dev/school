import { describe, expect, it } from "vitest";
import { MODULE_GROUPS, MODULES, moduleRights } from "@/config/modules";
import { csvCell } from "@/features/shared/csv";

describe("registers (config/modules.ts)", () => {
  it("have unique keys, a known group, stages and fields with unique names", () => {
    expect(new Set(MODULES.map((m) => m.key)).size).toBe(MODULES.length);
    for (const m of MODULES) {
      expect(MODULE_GROUPS, m.key).toContain(m.group);
      expect(m.statuses.length, m.key).toBeGreaterThan(0);
      expect(new Set(m.fields.map((f) => f.key)).size, m.key).toBe(m.fields.length);
      for (const f of m.fields)
        if (f.type === "select") expect(f.options?.length, `${m.key}.${f.key}`).toBeGreaterThan(0);
    }
  });

  it("never let a parent or student read everyone's records about students", () => {
    for (const m of MODULES.filter((x) => x.student)) {
      for (const role of ["parent", "student"] as const)
        expect(moduleRights(m, role).viewAll, `${m.key} ${role}`).toBe(false);
    }
  });

  it("keep private matters with the people who handle them", () => {
    for (const key of ["safeguarding", "counselling", "grievances", "discipline"]) {
      const m = MODULES.find((x) => x.key === key)!;
      for (const role of ["parent", "student", "accountant", "librarian"] as const)
        expect(moduleRights(m, role).viewAll, `${key} ${role}`).toBe(false);
      expect(moduleRights(m, "teacher").viewAll, key).toBe(false);
    }
  });
});

describe("CSV download", () => {
  it("stops a spreadsheet formula and quotes separators", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("-12.5")).toBe("-12.5");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
  });
});
