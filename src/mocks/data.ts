/**
 * DEVELOPMENT-ONLY mock fixtures. Fictional people and schools; nothing here is real or persisted.
 * Used by `src/services/mock` only. Switch to the real backend with NEXT_PUBLIC_DATA_SOURCE=api.
 */
import type {
  Approval,
  AuditEntry,
  Book,
  CalendarEvent,
  Campus,
  Child,
  CertificateRequest,
  Enquiry,
  EventPlan,
  ExamEntry,
  FeeHead,
  IssueRegisterEntry,
  LeaveRequest,
  LedgerEntry,
  Loan,
  Notice,
  OnboardingItem,
  ParentQuery,
  ResultRow,
  RosterStudent,
  ServiceStatus,
  SessionUser,
  Staff,
  Student,
  SupportRequest,
  Tenant,
  TimetableSlot,
  TransportRoute,
  Vehicle,
  Vendor,
  Invoice,
  TeachingClass,
} from "@/types";

const FIRST = [
  "Aarav",
  "Anaya",
  "Vihaan",
  "Diya",
  "Arjun",
  "Ishita",
  "Kabir",
  "Myra",
  "Reyansh",
  "Saanvi",
  "Advait",
  "Kiara",
  "Rohan",
  "Tara",
  "Vivaan",
  "Zoya",
  "Neil",
  "Riya",
  "Dev",
  "Meera",
  "Yash",
  "Pari",
  "Ayaan",
  "Nisha",
];
const LAST = [
  "Mehta",
  "Rao",
  "Sharma",
  "Iyer",
  "Nair",
  "Kulkarni",
  "Das",
  "Shah",
  "Verma",
  "Reddy",
  "Bose",
  "Khan",
];
const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length] as T;
const person = (i: number) => `${pick(FIRST, i)} ${pick(LAST, i * 5 + 3)}`;
const pad = (n: number, w = 3) => String(n).padStart(w, "0");

export const SCHOOL_NAME = "Northfield Academy";

/* ---------- Session personas (development sign-in only) ---------- */
export const PERSONAS: SessionUser[] = [
  {
    id: "u-platform",
    name: "Platform Admin",
    role: "platform_admin",
    tenantId: null,
    tenantName: null,
    title: "Platform administrator",
  },
  {
    id: "u-owner",
    name: "Rajiv Malhotra",
    role: "school_owner",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "School owner",
  },
  {
    id: "u-principal",
    name: "Dr. Meera Nair",
    role: "principal",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "Principal",
  },
  {
    id: "u-teacher",
    name: "Kavita Iyer",
    role: "teacher",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "English teacher",
  },
  {
    id: "u-accountant",
    name: "Sanjay Kulkarni",
    role: "accountant",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "Accountant",
  },
  {
    id: "u-librarian",
    name: "Leela Das",
    role: "librarian",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "Librarian",
  },
  {
    id: "u-transport",
    name: "Imran Khan",
    role: "transport",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "Transport coordinator",
  },
  {
    id: "u-parent",
    name: "Rahul Mehta",
    role: "parent",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "Parent",
    childIds: ["c-aarav", "c-anaya"],
  },
  {
    id: "u-student",
    name: "Aarav Mehta",
    role: "student",
    tenantId: "t-northfield",
    tenantName: SCHOOL_NAME,
    title: "Class 7B student",
  },
];

export const CHILDREN: Child[] = [
  { id: "c-aarav", name: "Aarav Mehta", classSection: "7B", rollNo: 12 },
  { id: "c-anaya", name: "Anaya Mehta", classSection: "3A", rollNo: 5 },
];

/* ---------- Platform ---------- */
export const TENANTS: Tenant[] = [
  {
    id: "t-northfield",
    name: "Northfield Academy",
    plan: "Group",
    status: "active",
    campuses: 2,
    students: 1658,
    studentLimit: 2500,
    createdAt: "2025-04-02",
  },
  {
    id: "t-riverstone",
    name: "Riverstone Public School",
    plan: "Standard",
    status: "active",
    campuses: 1,
    students: 862,
    studentLimit: 1200,
    createdAt: "2025-06-18",
  },
  {
    id: "t-lakeview",
    name: "Lakeview Junior School",
    plan: "Starter",
    status: "trial",
    campuses: 1,
    students: 140,
    studentLimit: 400,
    createdAt: "2026-09-29",
  },
  {
    id: "t-hillcrest",
    name: "Hillcrest Academy",
    plan: "Standard",
    status: "active",
    campuses: 1,
    students: 690,
    studentLimit: 1000,
    createdAt: "2025-11-11",
  },
  {
    id: "t-oakridge",
    name: "Oakridge International",
    plan: "Group",
    status: "suspended",
    campuses: 3,
    students: 2100,
    studentLimit: 3000,
    createdAt: "2024-12-05",
  },
  {
    id: "t-maple",
    name: "Maple Grove School",
    plan: "Starter",
    status: "trial",
    campuses: 1,
    students: 0,
    studentLimit: 400,
    createdAt: "2026-10-19",
  },
];
export const ONBOARDING: OnboardingItem[] = [
  {
    id: "o1",
    tenant: "Lakeview Junior School",
    stage: "Importing student records",
    progressPct: 60,
    owner: "Onboarding team",
    status: "on_track",
  },
  {
    id: "o2",
    tenant: "Maple Grove School",
    stage: "Workspace created",
    progressPct: 15,
    owner: "Onboarding team",
    status: "on_track",
  },
  {
    id: "o3",
    tenant: "Oakridge International",
    stage: "Awaiting fee plan data",
    progressPct: 80,
    owner: "School admin",
    status: "blocked",
  },
  {
    id: "o4",
    tenant: "Hillcrest Academy",
    stage: "Launched",
    progressPct: 100,
    owner: "Onboarding team",
    status: "done",
  },
];
export const SUPPORT: SupportRequest[] = [
  {
    id: "s1",
    tenant: "Riverstone Public School",
    subject: "Cannot invite a new teacher",
    priority: "normal",
    status: "open",
    openedOn: "2026-10-25",
  },
  {
    id: "s2",
    tenant: "Oakridge International",
    subject: "Billing contact change",
    priority: "low",
    status: "in_progress",
    openedOn: "2026-10-22",
  },
  {
    id: "s3",
    tenant: "Northfield Academy",
    subject: "Report card template question",
    priority: "normal",
    status: "open",
    openedOn: "2026-10-24",
  },
  {
    id: "s4",
    tenant: "Hillcrest Academy",
    subject: "Import file rejected",
    priority: "high",
    status: "in_progress",
    openedOn: "2026-10-23",
  },
  {
    id: "s5",
    tenant: "Lakeview Junior School",
    subject: "How to add a campus",
    priority: "low",
    status: "closed",
    openedOn: "2026-10-12",
  },
];
export const SERVICE_STATUS: ServiceStatus[] = [
  { name: "Web application", state: "operational", note: "Sample status" },
  { name: "Notifications (email/SMS)", state: "unavailable", note: "Provider not connected" },
  { name: "Payment gateway", state: "unavailable", note: "Not connected" },
  {
    name: "Document generation (PDF)",
    state: "unavailable",
    note: "Not connected; previews are mock",
  },
  { name: "Live bus tracking (GPS)", state: "unavailable", note: "Not connected" },
];
export const AUDIT: AuditEntry[] = [
  {
    id: "a1",
    at: "2026-10-26 09:12",
    actor: "Dr. Meera Nair",
    action: "Published notice",
    target: "Unit Test 2 timetable",
    area: "notices",
  },
  {
    id: "a2",
    at: "2026-10-25 17:40",
    actor: "Sanjay Kulkarni",
    action: "Issued receipt",
    target: "Receipt 2041",
    area: "fees",
  },
  {
    id: "a3",
    at: "2026-10-25 15:02",
    actor: "Kavita Iyer",
    action: "Submitted attendance",
    target: "Class 6A",
    area: "attendance",
  },
  {
    id: "a4",
    at: "2026-10-24 11:30",
    actor: "Platform Admin",
    action: "Changed plan",
    target: "Hillcrest Academy",
    area: "platform",
  },
  {
    id: "a5",
    at: "2026-10-23 16:20",
    actor: "Dr. Meera Nair",
    action: "Approved certificate",
    target: "Bonafide · Diya Rao",
    area: "certificates",
  },
  {
    id: "a6",
    at: "2026-10-22 10:05",
    actor: "Rajiv Malhotra",
    action: "Invited user",
    target: "librarian@example.invalid",
    area: "settings",
  },
  {
    id: "a7",
    at: "2026-10-20 14:48",
    actor: "Dr. Meera Nair",
    action: "Viewed rollover preview",
    target: "2025–26 → 2026–27",
    area: "rollover",
  },
];

/* ---------- People ---------- */
const CLASSES = ["3A", "5B", "6A", "7B", "8A", "8B", "9A", "9B", "10A", "10B", "11S", "12S"];
export const STUDENTS: Student[] = Array.from({ length: 60 }, (_, i) => {
  const fee: Student["feeStatus"] = i % 7 === 0 ? "overdue" : i % 4 === 0 ? "partial" : "paid";
  return {
    id: `st-${pad(i + 1)}`,
    admissionNo: `NA${2200 + i}`,
    name: person(i),
    classSection: pick(CLASSES, i),
    rollNo: (i % 30) + 1,
    guardian: `${pick(FIRST, i + 7)} ${pick(LAST, i * 5 + 3)}`,
    phone: `+91 98${pad(10000 + i * 137, 5)}${pad(i % 100, 2)}`.slice(0, 15),
    status: i === 11 ? "pending" : i === 29 ? "transferred" : "active",
    feeStatus: fee,
    attendancePct: 78 + ((i * 7) % 22),
  };
});
export const STAFF: Staff[] = [
  ["Kavita Iyer", "Teacher", "English"],
  ["Arun Das", "Teacher", "Maths"],
  ["Priya Shah", "Teacher", "Science"],
  ["Mohan Rao", "Teacher", "Maths"],
  ["Neha Kulkarni", "Teacher", "Social Science"],
  ["Suresh Nair", "Teacher", "Hindi"],
  ["Dr. Meera Nair", "Principal", "Administration"],
  ["Sanjay Kulkarni", "Accountant", "Accounts"],
  ["Leela Das", "Librarian", "Library"],
  ["Imran Khan", "Transport coordinator", "Transport"],
  ["Anita Bose", "Office assistant", "Administration"],
  ["Vikram Reddy", "Teacher", "Physical Education"],
].map(([name, role, department], i) => ({
  id: `sf-${pad(i + 1)}`,
  name: name as string,
  role: role as string,
  department: department as string,
  phone: `+91 97${pad(20000 + i * 311, 5)}${pad(i, 2)}`.slice(0, 15),
  status: i === 5 ? "on_leave" : "active",
  joined: `20${15 + (i % 9)}-0${(i % 9) + 1}-15`,
}));
export const ENQUIRIES: Enquiry[] = Array.from({ length: 14 }, (_, i) => ({
  id: `en-${pad(i + 1)}`,
  studentName: person(i + 30),
  applyingFor: `Class ${(i % 9) + 1}`,
  guardian: `${pick(FIRST, i + 3)} ${pick(LAST, i + 2)}`,
  phone: `+91 96${pad(30000 + i * 223, 5)}${pad(i, 2)}`.slice(0, 15),
  source: pick(["Website", "Referral", "Walk-in", "Event"], i),
  stage: pick(["new", "documents", "review", "decision", "enrolled", "declined"] as const, i),
  createdAt: `2026-10-${pad((i % 24) + 1, 2)}`,
}));
export const CAMPUSES: Campus[] = [
  {
    id: "cp-main",
    name: "Northfield Academy — Main",
    address: "Main campus",
    students: 1248,
    principal: "Dr. Meera Nair",
    status: "active",
  },
  {
    id: "cp-jr",
    name: "Lakeview Junior Campus",
    address: "Junior campus",
    students: 410,
    principal: "Anita Bose",
    status: "active",
  },
  {
    id: "cp-east",
    name: "East Campus (planned)",
    address: "To be confirmed",
    students: 0,
    principal: "—",
    status: "planned",
  },
];

/* ---------- Finance ---------- */
export const INVOICES: Invoice[] = Array.from({ length: 36 }, (_, i) => {
  const amount = 12000 + (i % 5) * 2500;
  const status: Invoice["status"] =
    i % 7 === 0 ? "overdue" : i % 4 === 0 ? "partial" : i % 9 === 0 ? "pending" : "paid";
  const paid = status === "paid" ? amount : status === "partial" ? Math.round(amount / 2) : 0;
  return {
    id: `INV-${2400 + i}`,
    studentName: person(i),
    classSection: pick(CLASSES, i),
    term: "Term 2",
    amount,
    paid,
    due: `2026-10-${pad((i % 28) + 1, 2)}`,
    status,
  };
});
export const FEE_HEADS: FeeHead[] = [
  { id: "f1", name: "Tuition", classRange: "Classes 1–5", amount: 9000, frequency: "Per term" },
  { id: "f2", name: "Tuition", classRange: "Classes 6–10", amount: 11500, frequency: "Per term" },
  { id: "f3", name: "Tuition", classRange: "Classes 11–12", amount: 14000, frequency: "Per term" },
  {
    id: "f4",
    name: "Activity fee",
    classRange: "All classes",
    amount: 1500,
    frequency: "Per term",
  },
  { id: "f5", name: "Transport", classRange: "By route", amount: 3000, frequency: "Per term" },
  { id: "f6", name: "Laboratory", classRange: "Classes 9–12", amount: 1200, frequency: "Per year" },
];
export const ledgerFor = (studentId: string): LedgerEntry[] => {
  const seed = Number(studentId.replace(/\D/g, "")) || 1;
  const term = 11500;
  let bal = 0;
  const rows: LedgerEntry[] = [];
  const push = (id: string, date: string, description: string, debit: number, credit: number) => {
    bal += debit - credit;
    rows.push({ id, date, description, debit, credit, balance: bal });
  };
  push("l1", "2026-04-05", "Term 1 invoice", term, 0);
  push("l2", "2026-04-20", "Payment · receipt 1802", 0, term);
  push("l3", "2026-10-01", "Term 2 invoice", term, 0);
  if (seed % 3 !== 0)
    push("l4", "2026-10-12", "Payment · receipt 2041", 0, seed % 2 ? term : Math.round(term / 2));
  return rows;
};
export const VENDORS: Vendor[] = [
  {
    id: "v1",
    name: "Sunrise Stationers",
    category: "Stationery",
    contact: "[contact to be added]",
    status: "active",
  },
  {
    id: "v2",
    name: "BrightLab Supplies",
    category: "Laboratory",
    contact: "[contact to be added]",
    status: "active",
  },
  {
    id: "v3",
    name: "Metro Uniforms",
    category: "Uniforms",
    contact: "[contact to be added]",
    status: "inactive",
  },
];

/* ---------- Certificates ---------- */
export const CERT_REQUESTS: CertificateRequest[] = [
  {
    id: "cr-1",
    type: "Bonafide",
    studentName: "Diya Rao",
    classSection: "8A",
    requestedBy: "Parent",
    status: "pending",
    requestedOn: "2026-10-24",
  },
  {
    id: "cr-2",
    type: "Transfer",
    studentName: "Kabir Das",
    classSection: "9A",
    requestedBy: "Parent",
    status: "pending",
    requestedOn: "2026-10-22",
  },
  {
    id: "cr-3",
    type: "Character",
    studentName: "Myra Shah",
    classSection: "12S",
    requestedBy: "Office",
    status: "approved",
    requestedOn: "2026-10-20",
  },
  {
    id: "cr-4",
    type: "Bonafide",
    studentName: "Rohan Verma",
    classSection: "7B",
    requestedBy: "Parent",
    status: "issued",
    requestedOn: "2026-10-15",
  },
  {
    id: "cr-5",
    type: "Study",
    studentName: "Tara Reddy",
    classSection: "10A",
    requestedBy: "Parent",
    status: "rejected",
    requestedOn: "2026-10-10",
  },
];
export const ISSUE_REGISTER: IssueRegisterEntry[] = [
  {
    id: "ir-1",
    certNo: "NA/BON/2026/0142",
    type: "Bonafide",
    studentName: "Rohan Verma",
    issuedOn: "2026-10-16",
    signatory: "Dr. Meera Nair",
    status: "issued",
  },
  {
    id: "ir-2",
    certNo: "NA/CHR/2026/0031",
    type: "Character",
    studentName: "Myra Shah",
    issuedOn: "2026-10-21",
    signatory: "Dr. Meera Nair",
    status: "issued",
  },
  {
    id: "ir-3",
    certNo: "NA/TC/2026/0017",
    type: "Transfer",
    studentName: "Neil Bose",
    issuedOn: "2026-09-30",
    signatory: "Dr. Meera Nair",
    status: "reissued",
  },
  {
    id: "ir-4",
    certNo: "NA/BON/2026/0121",
    type: "Bonafide",
    studentName: "Pari Khan",
    issuedOn: "2026-09-12",
    signatory: "Dr. Meera Nair",
    status: "cancelled",
  },
];

/* ---------- Communication & operations ---------- */
export const NOTICES: Notice[] = [
  {
    id: "n1",
    title: "Unit Test 2 timetable",
    audience: "Classes 6–10",
    status: "published",
    publishedOn: "2026-10-26",
    author: "Dr. Meera Nair",
    body: "Unit Test 2 begins on 24 Oct. Please check the attached timetable.",
  },
  {
    id: "n2",
    title: "Parent meeting · Classes 1–5",
    audience: "Parents, Classes 1–5",
    status: "published",
    publishedOn: "2026-10-23",
    author: "Dr. Meera Nair",
    body: "The parent-teacher meeting is on 26 Oct from 10 am.",
  },
  {
    id: "n3",
    title: "Assembly moved to the ground",
    audience: "All staff and students",
    status: "published",
    publishedOn: "2026-10-22",
    author: "Anita Bose",
    body: "Thursday’s assembly will be held on the ground.",
  },
  {
    id: "n4",
    title: "Annual sports day schedule",
    audience: "All parents",
    status: "draft",
    publishedOn: null,
    author: "Vikram Reddy",
    body: "Draft: schedule to be confirmed.",
  },
];
export const CALENDAR: CalendarEvent[] = [
  {
    id: "ev1",
    date: "2026-10-24",
    title: "Unit Test 2 begins",
    kind: "exam",
    audience: "Classes 6–10",
  },
  {
    id: "ev2",
    date: "2026-10-26",
    title: "Parent meeting · Classes 1–5",
    kind: "meeting",
    audience: "Parents",
  },
  { id: "ev3", date: "2026-10-28", title: "Annual sports day", kind: "event", audience: "All" },
  { id: "ev4", date: "2026-11-08", title: "Diwali holiday", kind: "holiday", audience: "All" },
  { id: "ev5", date: "2026-11-09", title: "Diwali holiday", kind: "holiday", audience: "All" },
  {
    id: "ev6",
    date: "2026-11-14",
    title: "Children’s Day celebration",
    kind: "event",
    audience: "All",
  },
  {
    id: "ev7",
    date: "2026-11-20",
    title: "Unit Test 2 results",
    kind: "exam",
    audience: "Parents, students",
  },
  { id: "ev8", date: "2026-12-25", title: "Winter break begins", kind: "holiday", audience: "All" },
];
export const LEAVES: LeaveRequest[] = [
  {
    id: "lv1",
    staffName: "Kavita Iyer",
    from: "2026-10-28",
    to: "2026-10-29",
    type: "Casual leave",
    status: "pending",
  },
  {
    id: "lv2",
    staffName: "Suresh Nair",
    from: "2026-10-24",
    to: "2026-10-30",
    type: "Medical leave",
    status: "approved",
  },
  {
    id: "lv3",
    staffName: "Priya Shah",
    from: "2026-11-02",
    to: "2026-11-02",
    type: "Casual leave",
    status: "pending",
  },
];
export const APPROVALS: Approval[] = [
  {
    id: "ap1",
    kind: "Certificate",
    subject: "Bonafide · Diya Rao (8A)",
    requestedBy: "Office",
    requestedOn: "2026-10-24",
    status: "pending",
  },
  {
    id: "ap2",
    kind: "Certificate",
    subject: "Transfer · Kabir Das (9A)",
    requestedBy: "Parent",
    requestedOn: "2026-10-22",
    status: "pending",
  },
  {
    id: "ap3",
    kind: "Staff leave",
    subject: "Kavita Iyer · 28–29 Oct",
    requestedBy: "Kavita Iyer",
    requestedOn: "2026-10-25",
    status: "pending",
  },
  {
    id: "ap4",
    kind: "Fee concession",
    subject: "Sibling policy · Class 7B",
    requestedBy: "Accounts",
    requestedOn: "2026-10-25",
    status: "pending",
  },
  {
    id: "ap5",
    kind: "Purchase",
    subject: "Laboratory supplies · BrightLab",
    requestedBy: "Priya Shah",
    requestedOn: "2026-10-21",
    status: "pending",
  },
];
export const EVENT_PLANS: EventPlan[] = [
  {
    id: "ep1",
    name: "Annual sports day",
    date: "2026-10-28",
    owner: "Vikram Reddy",
    budget: 85000,
    status: "confirmed",
  },
  {
    id: "ep2",
    name: "Children’s Day celebration",
    date: "2026-11-14",
    owner: "Neha Kulkarni",
    budget: 30000,
    status: "planning",
  },
  {
    id: "ep3",
    name: "Annual day",
    date: "2026-12-12",
    owner: "Dr. Meera Nair",
    budget: 220000,
    status: "planning",
  },
  {
    id: "ep4",
    name: "Science exhibition",
    date: "2026-09-05",
    owner: "Priya Shah",
    budget: 40000,
    status: "done",
  },
];
export const QUERIES: ParentQuery[] = [
  {
    id: "q1",
    parent: "Rahul Mehta",
    subject: "Bus pick-up time change",
    assignedTo: "Imran Khan",
    status: "in_progress",
    openedOn: "2026-10-25",
  },
  {
    id: "q2",
    parent: "Sunita Rao",
    subject: "Fee receipt not received",
    assignedTo: "Sanjay Kulkarni",
    status: "open",
    openedOn: "2026-10-26",
  },
  {
    id: "q3",
    parent: "Ajay Verma",
    subject: "Syllabus for Unit Test 2",
    assignedTo: "Arun Das",
    status: "resolved",
    openedOn: "2026-10-20",
  },
];
export const BOOKS: Book[] = Array.from({ length: 24 }, (_, i) => ({
  id: `bk-${pad(i + 1)}`,
  title:
    pick(
      [
        "The Jungle Book",
        "Wings of Fire",
        "Malgudi Days",
        "Panchatantra Tales",
        "A Brief History of Time",
        "Gitanjali",
        "Discovery of India",
        "Swami and Friends",
      ],
      i,
    ) + (i >= 8 ? ` (Vol. ${Math.floor(i / 8) + 1})` : ""),
  author: pick(
    [
      "R. Kipling",
      "A. P. J. Abdul Kalam",
      "R. K. Narayan",
      "Vishnu Sharma",
      "S. Hawking",
      "R. Tagore",
      "J. Nehru",
      "R. K. Narayan",
    ],
    i,
  ),
  isbn: `978-00-${pad(1000 + i * 17, 4)}-${i % 10}`,
  copies: 3 + (i % 4),
  available: i % 5 === 0 ? 0 : 1 + (i % 3),
}));
export const LOANS: Loan[] = [
  {
    id: "ln1",
    book: "Wings of Fire",
    member: "Aarav Mehta (7B)",
    issued: "2026-10-12",
    due: "2026-10-26",
    status: "issued",
  },
  {
    id: "ln2",
    book: "Malgudi Days",
    member: "Diya Rao (8A)",
    issued: "2026-10-01",
    due: "2026-10-15",
    status: "overdue",
  },
  {
    id: "ln3",
    book: "Gitanjali",
    member: "Kavita Iyer (Staff)",
    issued: "2026-10-05",
    due: "2026-10-19",
    status: "overdue",
  },
  {
    id: "ln4",
    book: "The Jungle Book",
    member: "Anaya Mehta (3A)",
    issued: "2026-09-20",
    due: "2026-10-04",
    status: "returned",
  },
];
export const VEHICLES: Vehicle[] = [
  {
    id: "vh1",
    regNo: "KA-01-AB-1001",
    route: "Route 1 · North",
    driver: "Ramesh K.",
    capacity: 40,
    status: "active",
  },
  {
    id: "vh2",
    regNo: "KA-01-AB-1002",
    route: "Route 2 · East",
    driver: "Mahesh P.",
    capacity: 40,
    status: "active",
  },
  {
    id: "vh3",
    regNo: "KA-01-AB-1003",
    route: "Route 3 · South",
    driver: "Salim A.",
    capacity: 32,
    status: "maintenance",
  },
];
export const ROUTES: TransportRoute[] = [
  { id: "rt1", name: "Route 1 · North", stops: 12, students: 36, vehicle: "KA-01-AB-1001" },
  { id: "rt2", name: "Route 2 · East", stops: 10, students: 31, vehicle: "KA-01-AB-1002" },
  { id: "rt3", name: "Route 3 · South", stops: 9, students: 24, vehicle: "KA-01-AB-1003" },
];
export const EXAMS: ExamEntry[] = [
  {
    id: "ex1",
    date: "2026-10-27",
    subject: "Science",
    classSection: "Class 9",
    kind: "Unit Test 2",
    room: "Hall A",
  },
  {
    id: "ex2",
    date: "2026-10-28",
    subject: "Maths",
    classSection: "Class 10",
    kind: "Unit Test 2",
    room: "Hall B",
  },
  {
    id: "ex3",
    date: "2026-10-29",
    subject: "English",
    classSection: "Class 8",
    kind: "Unit Test 2",
    room: "Room 14",
  },
  {
    id: "ex4",
    date: "2026-10-30",
    subject: "Physics (practical)",
    classSection: "Class 12",
    kind: "Practical",
    room: "Lab 1",
  },
  {
    id: "ex5",
    date: "2026-10-31",
    subject: "Social Science",
    classSection: "Class 7",
    kind: "Unit Test 2",
    room: "Room 9",
  },
];

/* ---------- Teacher workspace ---------- */
export const TEACHER_CLASSES: TeachingClass[] = [
  {
    id: "6A",
    label: "Class 6A",
    subject: "English",
    period: "Period 2",
    time: "09:40–10:20",
    room: "Room 6",
    studentCount: 14,
  },
  {
    id: "8A",
    label: "Class 8A",
    subject: "English",
    period: "Period 3",
    time: "10:30–11:10",
    room: "Room 14",
    studentCount: 14,
  },
  {
    id: "9B",
    label: "Class 9B",
    subject: "English",
    period: "Period 5",
    time: "12:30–13:10",
    room: "Room 21",
    studentCount: 14,
  },
];
export const rosterFor = (classId: string): RosterStudent[] => {
  const base = classId.charCodeAt(0) + classId.length * 3;
  return Array.from({ length: 14 }, (_, i) => ({
    id: `${classId}-${pad(i + 1, 2)}`,
    name: person(base + i * 2),
    rollNo: i + 1,
  }));
};
export const TEACHER_TIMETABLE: TimetableSlot[] = [
  {
    period: "P1",
    time: "08:45–09:30",
    subject: "Free period",
    classLabel: "—",
    room: "Staff room",
  },
  { period: "P2", time: "09:40–10:20", subject: "English", classLabel: "Class 6A", room: "Room 6" },
  {
    period: "P3",
    time: "10:30–11:10",
    subject: "English",
    classLabel: "Class 8A",
    room: "Room 14",
  },
  { period: "P4", time: "11:20–12:00", subject: "Library duty", classLabel: "—", room: "Library" },
  {
    period: "P5",
    time: "12:30–13:10",
    subject: "English",
    classLabel: "Class 9B",
    room: "Room 21",
  },
];
export const STUDENT_TIMETABLE: TimetableSlot[] = [
  {
    period: "P1",
    time: "08:45–09:30",
    subject: "Maths",
    classLabel: "Class 7B",
    room: "Room 9",
    teacher: "Arun Das",
  },
  {
    period: "P2",
    time: "09:40–10:20",
    subject: "Science",
    classLabel: "Class 7B",
    room: "Lab 2",
    teacher: "Priya Shah",
  },
  {
    period: "P3",
    time: "10:30–11:10",
    subject: "English",
    classLabel: "Class 7B",
    room: "Room 9",
    teacher: "Kavita Iyer",
  },
  {
    period: "P4",
    time: "11:20–12:00",
    subject: "Hindi",
    classLabel: "Class 7B",
    room: "Room 9",
    teacher: "Suresh Nair",
  },
  {
    period: "P5",
    time: "12:30–13:10",
    subject: "Social Science",
    classLabel: "Class 7B",
    room: "Room 9",
    teacher: "Neha Kulkarni",
  },
];
export const SYLLABUS: { classLabel: string; subject: string; pct: number }[] = [
  { classLabel: "Class 6A", subject: "English", pct: 62 },
  { classLabel: "Class 8A", subject: "English", pct: 55 },
  { classLabel: "Class 9B", subject: "English", pct: 48 },
];

/* ---------- Parent / student ---------- */
export const RESULTS: ResultRow[] = [
  { subject: "Maths", assessment: "Unit Test 1", marks: 41, max: 50, grade: "A" },
  { subject: "Science", assessment: "Unit Test 1", marks: 38, max: 50, grade: "A" },
  { subject: "English", assessment: "Unit Test 1", marks: 36, max: 50, grade: "B+" },
  { subject: "Hindi", assessment: "Unit Test 1", marks: 34, max: 50, grade: "B+" },
  { subject: "Social Science", assessment: "Unit Test 1", marks: 40, max: 50, grade: "A" },
];
export const PTM_SLOTS = [
  { id: "p1", teacher: "Kavita Iyer (English)", date: "2026-10-31", time: "10:00", booked: false },
  { id: "p2", teacher: "Kavita Iyer (English)", date: "2026-10-31", time: "10:15", booked: true },
  { id: "p3", teacher: "Arun Das (Maths)", date: "2026-10-31", time: "11:00", booked: false },
  { id: "p4", teacher: "Priya Shah (Science)", date: "2026-10-31", time: "11:30", booked: false },
];
export const STAFF_SCHOOL_AUDIENCES = [
  "All staff and students",
  "All parents",
  "All staff",
  "Classes 1–5",
  "Classes 6–10",
  "Classes 11–12",
  "Class 8A parents",
];
