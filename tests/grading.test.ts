import { describe, expect, it } from "vitest";
import { CBSE_SCALE, GENERIC_SCALE, ALL_BOARDS } from "@/data/boards";
import { computeResult, gradeFor, percentOf, rankBy, validateScale } from "@/server/grading";

describe("grade bands", () => {
  it.each([
    [100, "A1"],
    [91, "A1"],
    [90, "A2"],
    [81, "A2"],
    [80, "B1"],
    [61, "B2"],
    [51, "C1"],
    [41, "C2"],
    [40, "D"],
    [33, "D"],
    [32, "E"],
    [0, "E"],
  ])("CBSE: %i%% is %s", (pct, grade) => {
    expect(gradeFor(pct, CBSE_SCALE)?.name).toBe(grade);
  });

  it("percentage rounds half up to a whole number", () => {
    expect(percentOf(90.5, 100)).toBe(91);
    expect(percentOf(90.4, 100)).toBe(90);
    expect(percentOf(7, 20)).toBe(35);
    expect(percentOf(5, 0)).toBe(0);
  });

  it("every default board scale is valid and every board code is unique", () => {
    expect(validateScale(CBSE_SCALE)).toBeNull();
    expect(validateScale(GENERIC_SCALE)).toBeNull();
    const codes = ALL_BOARDS.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(ALL_BOARDS.length).toBe(6 + 36);
  });
});

describe("scale validation", () => {
  const b = (name: string, from: number, to: number) => ({ name, from, to, remark: "" });
  it("rejects gaps, overlaps, bad ends and duplicates", () => {
    expect(validateScale([b("A", 50, 100), b("B", 0, 48)])).toMatch(/gap/);
    expect(validateScale([b("A", 50, 100), b("B", 0, 50)])).toMatch(/overlap/);
    expect(validateScale([b("A", 51, 100), b("B", 1, 50)])).toMatch(/start at 0/);
    expect(validateScale([b("A", 51, 99), b("B", 0, 50)])).toMatch(/end at 100/);
    expect(validateScale([b("A", 51, 100), b("A", 0, 50)])).toMatch(/twice/);
    expect(validateScale([b("A", 0, 100)])).toMatch(/between 2 and 12/);
    expect(validateScale([b("A", 50.5, 100), b("B", 0, 50)])).toMatch(/whole numbers/);
  });
  it("accepts a valid custom scale in any order", () => {
    expect(validateScale([b("Pass", 40, 100), b("Fail", 0, 39)])).toBeNull();
  });
});

describe("exam result", () => {
  it("computes totals, overall grade and pass", () => {
    const r = computeResult(
      [
        { subject: "English", score: 78 },
        { subject: "Maths", score: 92 },
        { subject: "Science", score: 85 },
      ],
      100,
      33,
      CBSE_SCALE,
    );
    expect(r.total).toBe(255);
    expect(r.maxTotal).toBe(300);
    expect(r.percent).toBe(85);
    expect(r.grade).toBe("A2");
    expect(r.result).toBe("pass");
    expect(r.subjects.map((s) => s.grade)).toEqual(["B1", "A1", "A2"]);
  });

  it("fails the exam if any one subject is below the pass percentage, even with a high total", () => {
    const r = computeResult(
      [
        { subject: "English", score: 100 },
        { subject: "Maths", score: 100 },
        { subject: "Science", score: 20 },
      ],
      100,
      33,
      CBSE_SCALE,
    );
    expect(r.percent).toBe(73);
    expect(r.result).toBe("fail");
  });

  it("a missing mark leaves the card incomplete with no pass/fail or overall grade", () => {
    const r = computeResult(
      [
        { subject: "English", score: 90 },
        { subject: "Maths", score: null },
      ],
      100,
      33,
      CBSE_SCALE,
    );
    expect(r.result).toBe("incomplete");
    expect(r.percent).toBeNull();
    expect(r.grade).toBeNull();
  });

  it("works for a non-100 maximum and a custom pass mark", () => {
    const r = computeResult([{ subject: "Unit test", score: 18 }], 20, 40, CBSE_SCALE);
    expect(r.subjects[0]!.percent).toBe(90);
    expect(r.subjects[0]!.grade).toBe("A2");
    expect(r.result).toBe("pass");
  });
});

describe("ranking", () => {
  it("ties share a rank and the next rank is skipped", () => {
    const ranks = rankBy([
      { id: "a", total: 280 },
      { id: "b", total: 290 },
      { id: "c", total: 280 },
      { id: "d", total: 100 },
    ]);
    expect(ranks.get("b")).toBe(1);
    expect(ranks.get("a")).toBe(2);
    expect(ranks.get("c")).toBe(2);
    expect(ranks.get("d")).toBe(4);
  });
});
