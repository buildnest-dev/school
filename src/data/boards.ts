import { STATES_AND_DISTRICTS, UT_NAMES } from "./india-geo";

export interface GradeBand {
  name: string;
  from: number;
  to: number;
  remark: string;
}

/**
 * Default grading scales. They are EDITABLE DEFAULTS stored per board, not an authoritative copy of
 * each board's rules: boards change schemes, so a school admin should confirm them before report cards
 * are issued.
 */
export const CBSE_SCALE: GradeBand[] = [
  { name: "A1", from: 91, to: 100, remark: "Outstanding" },
  { name: "A2", from: 81, to: 90, remark: "Excellent" },
  { name: "B1", from: 71, to: 80, remark: "Very Good" },
  { name: "B2", from: 61, to: 70, remark: "Good" },
  { name: "C1", from: 51, to: 60, remark: "Fair" },
  { name: "C2", from: 41, to: 50, remark: "Average" },
  { name: "D", from: 33, to: 40, remark: "Pass" },
  { name: "E", from: 0, to: 32, remark: "Needs improvement" },
];

export const GENERIC_SCALE: GradeBand[] = [
  { name: "A+", from: 90, to: 100, remark: "Outstanding" },
  { name: "A", from: 80, to: 89, remark: "Excellent" },
  { name: "B+", from: 70, to: 79, remark: "Very Good" },
  { name: "B", from: 60, to: 69, remark: "Good" },
  { name: "C", from: 50, to: 59, remark: "Satisfactory" },
  { name: "D", from: 33, to: 49, remark: "Pass" },
  { name: "E", from: 0, to: 32, remark: "Needs improvement" },
];

export interface BoardSeed {
  code: string;
  name: string;
  kind: "national" | "international" | "open" | "state";
  stateName?: string;
  scale: GradeBand[];
}

const slug = (s: string) =>
  s
    .toUpperCase()
    .replace(/[^A-Z]+/g, "-")
    .replace(/^-|-$/g, "");

export const NATIONAL_BOARDS: BoardSeed[] = [
  {
    code: "CBSE",
    name: "CBSE (Central Board of Secondary Education)",
    kind: "national",
    scale: CBSE_SCALE,
  },
  { code: "ICSE", name: "ICSE (CISCE, Class 10)", kind: "national", scale: GENERIC_SCALE },
  { code: "ISC", name: "ISC (CISCE, Class 12)", kind: "national", scale: GENERIC_SCALE },
  {
    code: "NIOS",
    name: "NIOS (National Institute of Open Schooling)",
    kind: "open",
    scale: GENERIC_SCALE,
  },
  {
    code: "IB",
    name: "IB (International Baccalaureate)",
    kind: "international",
    scale: GENERIC_SCALE,
  },
  {
    code: "CAMBRIDGE",
    name: "Cambridge (IGCSE / A Level)",
    kind: "international",
    scale: GENERIC_SCALE,
  },
];

/** One generic board entry per state/UT so any state board can be selected and its scale tuned. */
export const STATE_BOARDS: BoardSeed[] = Object.keys(STATES_AND_DISTRICTS).map((s) => ({
  code: `STATE-${slug(s)}`,
  name: `${s} State Board`,
  kind: "state" as const,
  stateName: s,
  scale: GENERIC_SCALE,
}));

export const ALL_BOARDS: BoardSeed[] = [...NATIONAL_BOARDS, ...STATE_BOARDS];
export { UT_NAMES };
