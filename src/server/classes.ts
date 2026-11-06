import { z } from "zod";

export const STAGES = [
  "pre-primary",
  "primary",
  "middle",
  "secondary",
  "senior-secondary",
] as const;

/** The usual Indian structure, in promotion order. */
export const STANDARD_CLASSES: { name: string; stage: (typeof STAGES)[number] }[] = [
  { name: "Nursery", stage: "pre-primary" },
  { name: "LKG", stage: "pre-primary" },
  { name: "UKG", stage: "pre-primary" },
  ...Array.from({ length: 12 }, (_, i) => ({
    name: `Class ${i + 1}`,
    stage: (i < 5
      ? "primary"
      : i < 8
        ? "middle"
        : i < 10
          ? "secondary"
          : "senior-secondary") as (typeof STAGES)[number],
  })),
];

export const sectionName = z
  .string()
  .trim()
  .min(1)
  .max(10)
  .regex(/^[A-Za-z0-9 -]+$/, "Use letters or digits");

export const subjectNames = z.array(z.string().trim().min(2).max(60)).min(1).max(30);
