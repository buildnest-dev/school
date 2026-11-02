import type { IconName } from "@/components/ui/icon";

export interface Capability {
  icon: IconName;
  title: string;
  body: string;
  points?: string[];
}

export const LEAD_CAPABILITIES: Capability[] = [
  {
    icon: "setup",
    title: "School onboarding & configuration",
    body: "Set up a school's workspace: branding, academic structure, classes and sections, then invite the people who will use it.",
    points: ["Guided workspace setup", "Roles and permissions per school"],
  },
  {
    icon: "admissions",
    title: "Admissions & student records",
    body: "Carry an enquiry through to an enrolled student and keep every profile complete and current.",
    points: ["Enquiry-to-enrollment pipeline", "Guardian and document records"],
  },
  {
    icon: "campus",
    title: "Multi-campus administration",
    body: "Give authorized group leaders a consolidated view while each campus keeps its own operational boundaries.",
    points: ["Group-level overview", "Campus-level workspaces"],
  },
];

export const LIST_CAPABILITIES: Capability[] = [
  {
    icon: "safety",
    title: "Attendance & student safety",
    body: "Mark attendance in minutes and spot absences early enough to follow up with families.",
  },
  {
    icon: "timetable",
    title: "Academic planning & timetables",
    body: "Plan around teachers, rooms and periods, and see clashes before they reach a classroom.",
  },
  {
    icon: "fees",
    title: "Fees & financial administration",
    body: "Define fee structures, record payments and see outstanding dues without separate sheets.",
  },
  {
    icon: "exams",
    title: "Examinations & report cards",
    body: "Schedule assessments, enter marks once and produce consistent report cards.",
  },
  {
    icon: "certs",
    title: "Certificates & official documents",
    body: "Issue bonafide, transfer and other certificates from verified student records.",
  },
  {
    icon: "staff",
    title: "Staff coordination",
    body: "Coordinate leave, substitutions and routine tasks so the day starts organized.",
  },
  {
    icon: "comms",
    title: "Parent & student communication",
    body: "Send notices and updates to the right class, section or family from one place.",
  },
  {
    icon: "learning",
    title: "Learning materials & assignments",
    body: "Share notes and homework, and keep track of what has been set.",
  },
  {
    icon: "analytics",
    title: "Reports & analytics",
    body: "Turn day-to-day records into reports leadership can review without manual compilation.",
  },
];

export const FLOW_STEPS = [
  {
    n: "01",
    title: "One shared platform",
    body: "A single product, maintained centrally, so every school benefits from the same improvements.",
  },
  {
    n: "02",
    title: "Separate school workspaces",
    body: "Each school configures its own classes, boards, fee plans, calendar and branding. Workspaces are designed to stay isolated from one another.",
  },
  {
    n: "03",
    title: "Role-specific access",
    body: "People are invited into their school's workspace and see only what their role allows.",
  },
  {
    n: "04",
    title: "Connected daily operations",
    body: "Records flow between modules, so the same information is entered once and used everywhere it is needed.",
  },
] as const;

export const SHOWCASE_STAGES = [
  {
    nav: "Institution",
    title: "Institution overview, set up in a few clear steps.",
    body: "School administrators configure the workspace once: structure, roles and campuses, with a plain view of what is still to do.",
  },
  {
    nav: "Academics",
    title: "Academics, timetable, exams and attendance together.",
    body: "Plan the week, schedule assessments and watch attendance from the same place, with clashes flagged before the bell.",
  },
  {
    nav: "Finance & workflows",
    title: "Fees, certificates and approvals with a visible trail.",
    body: "Record payments, track dues and move requests through each step with a clear owner and status.",
  },
  {
    nav: "Communication",
    title: "Families and students stay informed, with reports for leaders.",
    body: "Notices reach the right audience, parents see their own child's information, and leadership reviews reports without manual compilation.",
  },
] as const;

export const ROLES = [
  {
    id: "owners",
    label: "Owners & management",
    heading: "A clear view of the whole institution.",
    body: "Enrollment, collections and campus performance without waiting for a compiled report. Authorized group owners can compare campuses.",
    title: "Owner home",
    rows: [
      ["Enrollment this term", "+36"],
      ["Fee collection vs plan", "74%"],
      ["Campuses reporting today", "3 of 3"],
    ],
  },
  {
    id: "admins",
    label: "Principals & administrators",
    heading: "Run the day from one queue.",
    body: "Approvals, timetable conflicts, staff leave and school-wide updates in one place, each with an owner and a status.",
    title: "Administrator home",
    rows: [
      ["Pending approvals", "5"],
      ["Timetable conflicts", "2"],
      ["Staff on leave tomorrow", "3"],
    ],
  },
  {
    id: "teachers",
    label: "Teachers",
    heading: "Classroom tools without the paperwork.",
    body: "Teachers see their own timetable and classes, mark attendance, enter marks and share materials.",
    title: "Teacher home",
    rows: [
      ["Next class", "8B · P3"],
      ["Attendance to mark", "2 classes"],
      ["Marks due", "Unit Test 2"],
    ],
  },
  {
    id: "accounts",
    label: "Accountants & office staff",
    heading: "Fees and records, reconciled.",
    body: "Record receipts, follow dues and process concessions and certificate requests with a clear trail.",
    title: "Accounts home",
    rows: [
      ["Receipts today", "18"],
      ["Dues this week", "₹2.4L"],
      ["Concession requests", "2"],
    ],
  },
  {
    id: "parents",
    label: "Parents",
    heading: "Their child's school life, clearly.",
    body: "Parents see their own child's attendance, results, fee dues and school notices, and can raise requests.",
    title: "Parent home",
    rows: [
      ["Attendance this month", "96%"],
      ["Fee due", "₹14,500"],
      ["New notices", "2"],
    ],
  },
  {
    id: "students",
    label: "Students",
    heading: "What is due, and what is next.",
    body: "Students see their timetable, assignments, materials and results, and nothing meant for staff.",
    title: "Student home",
    rows: [
      ["Today's classes", "6"],
      ["Homework due", "2"],
      ["Next exam", "24 Oct"],
    ],
  },
] as const;

export const YEAR_STEPS = [
  { title: "Close the year", body: "Finalise results and dues for the outgoing year." },
  { title: "Plan promotions", body: "Review who moves up, class by class, before applying." },
  { title: "Allocate sections", body: "Distribute students across the new sections." },
  {
    title: "Fee plans & calendar",
    body: "Set up updated fee structures and the academic calendar.",
  },
  { title: "Exam configuration", body: "Prepare assessment schemes for the new year." },
] as const;

export const PRESERVED = [
  "Final results and report cards",
  "Fee receipts and dues ledger",
  "Attendance registers",
  "Certificates issued",
] as const;

export const TRUST_ITEMS = [
  {
    title: "Tenant isolation",
    body: "Each school's data is intended to be separated from every other school's.",
  },
  {
    title: "Role-based permissions",
    body: "People should see and do only what their role permits.",
  },
  {
    title: "Controlled access",
    body: "Administrators decide who is invited, and with which access.",
  },
  {
    title: "Historical records",
    body: "Closed academic years are meant to remain available for reference.",
  },
  { title: "Auditability", body: "Important actions are intended to leave a reviewable trail." },
] as const;
