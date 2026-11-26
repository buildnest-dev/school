import { describe, expect, it } from "vitest";
import { readLines } from "@/features/school/pay-lines";
import { readRooms, seatingPlan } from "@/features/school/seating-plan";
import { readFile } from "@/server/attachments";
import { netOf } from "@/server/payroll";
import { seesPoll } from "@/server/polls";
import { Question, scoreOf } from "@/server/quizzes";

describe("exam seating", () => {
  const students = ["7 A", "7 B"].flatMap((classLabel) =>
    Array.from({ length: 5 }, (_, i) => ({ name: `${classLabel}-${i}`, classLabel })),
  );

  it("alternates classes and keeps every student once", () => {
    const { rooms, unseated } = seatingPlan(students, readRooms("R1: 6\nR2: 4"));
    const seats = rooms.flatMap((r) => r.seats);
    expect(unseated).toHaveLength(0);
    expect(new Set(seats.map((s) => s.name)).size).toBe(10);
    seats.slice(1).forEach((s, i) => expect(s.classLabel).not.toBe(seats[i]!.classLabel));
  });

  it("reports whoever has no seat and ignores unreadable room lines", () => {
    expect(readRooms("R1: 3\nnonsense\nR2: 0")).toEqual([{ name: "R1", seats: 3 }]);
    expect(seatingPlan(students, [{ name: "R1", seats: 3 }]).unseated).toHaveLength(7);
  });
});

describe("payroll", () => {
  it("reads lines and refuses anything unclear", () => {
    expect(readLines("Basic: 28000\n\nAllowance : 500")).toEqual([
      { label: "Basic", rupees: 28000 },
      { label: "Allowance", rupees: 500 },
    ]);
    expect(readLines("Basic 28000")).toBeNull();
    expect(readLines("Basic: -5")).toBeNull();
  });

  it("takes deductions from earnings", () => {
    expect(netOf([{ label: "a", rupees: 100 }], [{ label: "b", rupees: 30 }])).toBe(70);
  });
});

describe("online tests", () => {
  const q = { text: "Two plus two?", options: ["3", "4"], answer: 1, marks: 2 };

  it("marks right answers only", () => {
    expect(scoreOf([q, q], [1, 0])).toBe(2);
    expect(scoreOf([q], [-1])).toBe(0);
    expect(scoreOf([q], [])).toBe(0);
  });

  it("refuses an answer that is not one of the choices", () => {
    expect(Question.safeParse({ ...q, answer: 2 }).success).toBe(false);
  });
});

describe("uploads", () => {
  it("accepts a real PDF and refuses a renamed file", () => {
    const pdf = Buffer.from("%PDF-1.4 sample file").toString("base64");
    expect(readFile(`data:application/pdf;base64,${pdf}`).mime).toBe("application/pdf");
    const html = Buffer.from("<html><script>1</script>").toString("base64");
    expect(() => readFile(html)).toThrow(/PDF, JPEG or PNG/);
  });

  it("refuses a file over 1 MB", () => {
    const big = Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(1024 * 1024)]);
    expect(() => readFile(big.toString("base64"))).toThrow(/larger than 1 MB/);
  });
});

describe("polls", () => {
  it("show each audience only its own", () => {
    expect(seesPoll("parents", "parent")).toBe(true);
    expect(seesPoll("parents", "teacher")).toBe(false);
    expect(seesPoll("staff", "student")).toBe(false);
    expect(seesPoll("staff", "librarian")).toBe(true);
  });
});
