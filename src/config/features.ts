import { MODULE_GROUPS, MODULES, moduleByKey, type ModuleGroup } from "./modules";
import { SCREENS, screenHref } from "./screens";

/**
 * The features ZAQSA can switch on or off for a school. One entry says what the feature does, which
 * screens it owns and which server addresses stop answering when it is off. Everything is on unless
 * switched off, so a school made before this list keeps working. Plans will choose from this list.
 */
export interface Feature {
  key: string;
  title: string;
  summary: string;
  /** What the school gets, in plain lines. */
  includes: string[];
  screens: string[];
  /** Server paths (after /api) that belong to this feature. */
  api: RegExp[];
}

const child = (rest: string) => new RegExp(`^/me/children/[^/]+/${rest}(/|$)`);
const under = (path: string) => new RegExp(`^${path}(/|$)`);

const MAIN: Feature[] = [
  {
    key: "admissions",
    title: "Admissions",
    summary: "Enquiries from first contact to an admitted student.",
    includes: [
      "Walk-in, phone and website enquiries",
      "Stages: new, documents, review, decision",
      "Admit into a class, with a bus choice",
      "Alerts to the office, class teacher and desks",
    ],
    screens: ["school-admissions"],
    api: [under("/admissions")],
  },
  {
    key: "attendance",
    title: "Student attendance",
    summary: "Daily class attendance, seen by the office and families.",
    includes: [
      "Teacher marks a class in one screen",
      "School-wide overview",
      "Absence alert to parents",
      "Parent and student attendance view",
    ],
    screens: [
      "school-attendance",
      "teacher-attendance",
      "teacher-attendance-class",
      "parent-attendance",
      "student-attendance",
    ],
    api: [under("/attendance"), child("attendance")],
  },
  {
    key: "staff-day",
    title: "Staff attendance and cover",
    summary: "Who is in today, and who takes an absent teacher's periods.",
    includes: ["Daily staff attendance", "Cover lessons with an alert to the covering teacher"],
    screens: ["school-staff-attendance", "school-cover", "teacher-covers"],
    api: [under("/staff-attendance"), under("/substitutions")],
  },
  {
    key: "leave",
    title: "Staff leave",
    summary: "Leave requests and decisions.",
    includes: ["Teacher applies for leave", "Office approves or refuses", "Leave list"],
    screens: ["school-leave", "teacher-leave"],
    api: [under("/staff/leave-requests"), under("/teacher/leave-requests")],
  },
  {
    key: "timetable",
    title: "Timetable",
    summary: "Bell schedule and weekly periods.",
    includes: [
      "Bell schedule",
      "Class and teacher timetables with clash checks",
      "Today's periods for teachers, parents and students",
    ],
    screens: ["school-timetable", "teacher-today", "parent-timetable", "student-timetable"],
    api: [under("/timetable"), under("/teacher/timetable"), child("timetable")],
  },
  {
    key: "homework",
    title: "Homework",
    summary: "Set homework, collect answers and give feedback.",
    includes: ["Draft and publish", "Done or not done", "Written and file answers", "Feedback"],
    screens: [
      "teacher-homework",
      "teacher-homework-new",
      "teacher-submissions",
      "parent-homework",
      "student-homework",
      "parent-answers",
      "student-answers",
    ],
    api: [
      under("/homework"),
      under("/homework-submissions"),
      child("homework"),
      child("homework-submissions"),
    ],
  },
  {
    key: "lessons",
    title: "Study material and lesson plans",
    summary: "What is taught and what students can read.",
    includes: ["Study material with files", "Lesson plans", "Syllabus progress"],
    screens: [
      "school-curriculum",
      "teacher-syllabus",
      "teacher-materials",
      "teacher-lessons",
      "student-materials",
    ],
    api: [
      under("/materials"),
      under("/teacher/lessons"),
      under("/teacher/syllabus-progress"),
      child("materials"),
    ],
  },
  {
    key: "online-tests",
    title: "Online tests",
    summary: "Multiple-choice tests marked at once.",
    includes: ["Teacher writes questions", "One attempt per student", "Automatic score"],
    screens: ["teacher-quizzes", "parent-quizzes", "student-quizzes"],
    api: [under("/quizzes"), child("quizzes")],
  },
  {
    key: "exams",
    title: "Exams and report cards",
    summary: "Datesheet, marks, results, report cards and seating.",
    includes: [
      "Exam datesheet",
      "Marks entry and approval",
      "Grades and printable report cards",
      "Exam seating plan",
    ],
    screens: [
      "school-exams",
      "school-results",
      "school-seating",
      "teacher-marks",
      "teacher-marks-class",
      "parent-results",
      "student-exams",
      "student-results",
    ],
    api: [
      under("/exams"),
      under("/marks"),
      under("/results"),
      under("/report-cards"),
      child("exams"),
      child("results"),
    ],
  },
  {
    key: "certificates",
    title: "Certificates",
    summary: "Bonafide, character and transfer certificates.",
    includes: ["Requests from parents", "Issue and register", "Public verification", "Print"],
    screens: [
      "school-certificates",
      "school-certificate-new",
      "school-certificate-register",
      "school-certificate-verify",
      "parent-certificates",
    ],
    api: [under("/certificates")],
  },
  {
    key: "fees",
    title: "Fees",
    summary: "Fee heads, invoices, payments and dues.",
    includes: [
      "Raise fees for a class",
      "Payments, receipts and refunds",
      "Payment screenshot checking",
      "Opening balances and student ledger",
      "Parent fee view",
    ],
    screens: [
      "school-fees",
      "school-fee-structure",
      "school-fee-ledger",
      "school-payment-proofs",
      "school-opening-balances",
      "school-payment-details",
      "school-refunds",
      "parent-fees",
    ],
    api: [
      under("/fees"),
      under("/payment-proofs"),
      under("/me/invoices"),
      under("/me/payment-info"),
      under("/school/bank"),
      child("ledger"),
      /^\/students\/[^/]+\/ledger$/,
    ],
  },
  {
    key: "payroll",
    title: "Payroll",
    summary: "Salary structure and monthly payslips.",
    includes: ["Earnings and deductions", "Monthly payslips", "Staff see their own payslip"],
    screens: ["school-payroll", "school-payslips", "teacher-payslips"],
    api: [under("/payroll"), under("/me/payslips")],
  },
  {
    key: "purchasing",
    title: "Vendors and stock",
    summary: "Suppliers and what is in the store.",
    includes: ["Vendor list", "Stock items", "Stock in and out"],
    screens: ["school-vendors", "school-stock"],
    api: [under("/vendors"), under("/stock")],
  },
  {
    key: "library",
    title: "Library",
    summary: "Books, loans, returns and fines.",
    includes: ["Catalogue", "Issue and return", "Overdue fines"],
    screens: ["school-library", "school-library-loans"],
    api: [under("/library")],
  },
  {
    key: "transport",
    title: "Transport",
    summary: "Vehicles, routes, stops and bus seats.",
    includes: [
      "Vehicles and paper expiry checks",
      "Routes and stops",
      "Waiting list for new admissions",
      "Live GPS is not included",
    ],
    screens: ["school-transport", "school-routes"],
    api: [under("/transport")],
  },
  {
    key: "parent-contact",
    title: "Parent queries and messages",
    summary: "Questions from parents and notes from teachers.",
    includes: ["Parent queries with replies", "Teacher note to a parent, with one reply"],
    screens: ["school-queries", "parent-queries", "parent-messages", "teacher-messages"],
    api: [under("/parent-queries"), under("/teacher/messages"), child("messages")],
  },
  {
    key: "ptm",
    title: "Parent-teacher meetings",
    summary: "Meeting slots that parents book.",
    includes: ["Open slots", "Parent booking and cancelling"],
    screens: ["school-ptm", "parent-ptm"],
    api: [under("/ptm-slots"), under("/me/ptm-slots")],
  },
  {
    key: "polls",
    title: "Polls and read receipts",
    summary: "Ask a question and see who has read a notice.",
    includes: ["Polls for staff, parents or students", "Notice read receipts"],
    screens: ["school-polls", "teacher-polls", "parent-polls", "student-polls"],
    api: [under("/polls"), under("/acknowledgements")],
  },
  {
    key: "calendar",
    title: "Calendar and events",
    summary: "Holidays, exams, functions and their owners.",
    includes: ["School calendar", "Events with owner and budget"],
    screens: ["school-calendar", "school-events", "parent-calendar", "student-calendar"],
    api: [under("/calendar"), under("/events")],
  },
  {
    key: "achievements",
    title: "Achievements",
    summary: "Awards and activities of students.",
    includes: ["Staff record achievements", "Families see them"],
    screens: [
      "school-achievements",
      "teacher-achievements",
      "parent-achievements",
      "student-achievements",
    ],
    api: [under("/achievements"), child("achievements")],
  },
  {
    key: "documents",
    title: "Student documents",
    summary: "Files kept for each student.",
    includes: ["Upload PDF or photo up to 1 MB", "Parents see their child's documents"],
    screens: ["school-student-files", "parent-documents"],
    api: [/^\/students\/[^/]+\/documents$/, child("documents")],
  },
  {
    key: "reports",
    title: "Reports",
    summary: "Summaries, a report builder and students to check on.",
    includes: ["Standard reports", "Report builder with CSV", "Early-warning list"],
    screens: ["school-reports", "school-report-builder", "school-early-warning"],
    api: [under("/reports")],
  },
  {
    key: "rollover",
    title: "Year rollover",
    summary: "Move students to the next academic year.",
    includes: ["Preview before running", "Promote or hold back"],
    screens: ["school-rollover"],
    api: [under("/academic-years/rollover")],
  },
];

const groupKey = (g: ModuleGroup) => `registers-${g.toLowerCase().replace(/[^a-z]+/g, "-")}`;

const REGISTERS: Feature[] = MODULE_GROUPS.map((group) => {
  const mine = MODULES.filter((m) => m.group === group);
  return {
    key: groupKey(group),
    title: `Registers: ${group}`,
    summary: `${mine.length} record lists the school keeps and moves through stages.`,
    includes: mine.map((m) => `${m.title}: ${m.description}`),
    screens: [],
    api: [],
  };
});

export const FEATURES: readonly Feature[] = [...MAIN, ...REGISTERS];
export const FEATURE_KEYS = FEATURES.map((f) => f.key);

/** What every school always has; nothing here can be switched off. */
export const ALWAYS_INCLUDED = [
  "Students and class sections",
  "Staff and their logins",
  "Notices",
  "Dashboards, approval inbox and notifications",
  "School settings, campuses, data export and audit history",
];

const registerFeature = (moduleKey: string) => {
  const m = moduleByKey(moduleKey);
  return m ? groupKey(m.group) : undefined;
};

/** The feature a server path (without /api) belongs to; undefined for the always-included parts. */
export function featureOfPath(path: string) {
  const record = /^\/records\/([^/]+)/.exec(path);
  if (record) return registerFeature(record[1]!);
  return FEATURES.find((f) => f.api.some((r) => r.test(path)))?.key;
}

export const registerOn = (moduleKey: string, off: readonly string[] = []) => {
  const key = registerFeature(moduleKey);
  return !key || !off.includes(key);
};

export function screenOn(
  screenId: string,
  off: readonly string[] = [],
  params: Record<string, string> = {},
) {
  if (!off.length) return true;
  if (/-records$/.test(screenId)) return REGISTERS.some((f) => !off.includes(f.key));
  if (/-record$/.test(screenId)) return registerOn(Object.values(params)[0] ?? "", off);
  return !FEATURES.some((f) => off.includes(f.key) && f.screens.includes(screenId));
}

/** Whether a link inside the app leads to a screen that is switched on. */
export function linkOn(href: string, off: readonly string[] = []): boolean {
  if (!off.length) return true;
  const s = SCREENS.find((x) => screenHref(x) === href);
  // A link to one class or record (…/attendance/abc) follows the list screen above it.
  if (!s) {
    const parent = href.slice(0, href.lastIndexOf("/"));
    return parent.length > 1 ? linkOn(parent, off) : true;
  }
  return screenOn(s.id, off);
}

export const readOff = (stored: string | null | undefined) =>
  (stored ?? "").split(",").filter((k) => FEATURE_KEYS.includes(k));
