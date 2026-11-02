/** Fictional institutions used only in illustrative interface previews. */
export type SchoolKey = "northfield" | "riverstone";

export interface SchoolSample {
  key: SchoolKey;
  name: string;
  initial: string;
  classes: string;
  enroll: number;
  enrollSub: string;
  present: number;
  presentSub: string;
  fees: number;
  feesSub: string;
  feesPct: number;
  wings: { label: string; pct: number }[];
}

export const SCHOOLS: Record<SchoolKey, SchoolSample> = {
  northfield: {
    key: "northfield",
    name: "Northfield Academy",
    initial: "N",
    classes: "Classes 1–12 · 38 sections",
    enroll: 1248,
    enrollSub: "+36 this term",
    present: 94.2,
    presentSub: "1,176 of 1,248 students",
    fees: 38.6,
    feesSub: "of ₹52.0L due · Term 2",
    feesPct: 74,
    wings: [
      { label: "Primary", pct: 96 },
      { label: "Middle", pct: 93 },
      { label: "Secondary", pct: 91 },
      { label: "Sr. Secondary", pct: 95 },
    ],
  },
  riverstone: {
    key: "riverstone",
    name: "Riverstone Public School",
    initial: "R",
    classes: "Nursery–10 · 27 sections",
    enroll: 862,
    enrollSub: "+21 this term",
    present: 91.8,
    presentSub: "791 of 862 students",
    fees: 21.4,
    feesSub: "of ₹30.5L due · Term 2",
    feesPct: 70,
    wings: [
      { label: "Pre-primary", pct: 97 },
      { label: "Primary", pct: 92 },
      { label: "Middle", pct: 90 },
      { label: "Secondary", pct: 88 },
    ],
  },
};

export const CAMPUSES = [
  { name: "Northfield Academy", students: 1248, present: "94.2%", fees: "74%" },
  { name: "Riverstone Public School", students: 862, present: "91.8%", fees: "70%" },
  { name: "Lakeview Junior Campus", students: 410, present: "95.1%", fees: "78%" },
] as const;

export const formatters = {
  int: (v: number) => Math.round(v).toLocaleString("en-IN"),
  pct: (v: number) => `${v.toFixed(1)}%`,
  lakh: (v: number) => `₹${v.toFixed(1)}L`,
} as const;
