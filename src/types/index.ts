/**
 * Frontend data models and DTOs.
 * These mirror what the UI needs. The backend developer may adjust field names; update this file and the
 * service adapters in `src/services/api` only. See docs/API_INTEGRATION.md.
 */

export type Role =
  | "platform_admin"
  | "school_owner"
  | "principal"
  | "vice_principal"
  | "admission_officer"
  | "hr"
  | "reception"
  | "teacher"
  | "accountant"
  | "librarian"
  | "transport"
  | "parent"
  | "student";

/** Which application shell a role works in. */
export type Area = "platform" | "school" | "teacher" | "parent" | "student";

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListParams {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  order?: "asc" | "desc";
  filters?: Record<string, string>;
}

/** Validation error contract expected from the backend (HTTP 422). */
export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string[]>;
}

/** Result of a write. `mode: "mock"` means nothing was stored on a server. */
export interface MutationResult {
  ok: true;
  mode: "mock" | "api";
  id?: string;
  message?: string;
}

export interface SessionUser {
  id: string;
  name: string;
  role: Role;
  /** Tenant (school) the session belongs to. Null for platform administrators. */
  tenantId: string | null;
  tenantName: string | null;
  title: string;
  /** Child ids a guardian may see. Only meaningful for parents. */
  childIds?: string[];
  /** Platform users must turn on the authenticator app before anything else is open to them. */
  mfaSetupRequired?: boolean;
}

/* ---------- Platform ---------- */
export interface Tenant {
  id: string;
  name: string;
  plan: "Starter" | "Standard" | "Group";
  status: "active" | "trial" | "suspended";
  campuses: number;
  students: number;
  studentLimit: number;
  createdAt: string;
}
export interface SupportRequest {
  id: string;
  tenant: string;
  subject: string;
  priority: "low" | "normal" | "high";
  status: "open" | "in_progress" | "closed";
  openedOn: string;
}
export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  area: string;
}
export interface ServiceStatus {
  name: string;
  state: "operational" | "degraded" | "unavailable";
  note: string;
}

/* ---------- People ---------- */
export interface Student {
  id: string;
  admissionNo: string;
  name: string;
  classSection: string;
  rollNo: number;
  guardian: string;
  phone: string;
  status: "active" | "pending" | "withdrawn" | "transferred" | "graduated";
  feeStatus: "paid" | "partial" | "overdue";
  attendancePct: number;
}
export interface Staff {
  id: string;
  name: string;
  role: string;
  department: string;
  phone: string;
  status: "active" | "on_leave" | "inactive";
  joined: string;
}
export interface Enquiry {
  id: string;
  studentName: string;
  applyingFor: string;
  guardian: string;
  phone: string;
  source: string;
  stage: "new" | "documents" | "review" | "decision" | "enrolled" | "declined";
  createdAt: string;
}
export interface Campus {
  id: string;
  name: string;
  address: string;
  students: number;
  principal: string;
  status: "active" | "planned";
}

/* ---------- Finance ---------- */
export interface Invoice {
  id: string;
  /** Printed invoice number, when the backend provides one. */
  number?: string;
  studentName: string;
  classSection: string;
  term: string;
  amount: number;
  paid: number;
  due: string;
  status: "paid" | "partial" | "overdue" | "pending";
}
export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}
export interface FeeHead {
  id: string;
  name: string;
  classRange: string;
  amount: number;
  frequency: string;
}
export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact: string;
  status: "active" | "inactive";
}

/* ---------- Certificates ---------- */
export type CertificateType = "Transfer" | "Bonafide" | "Character" | "Study" | "School leaving";
export interface CertificateRequest {
  id: string;
  type: CertificateType;
  studentName: string;
  classSection: string;
  requestedBy: string;
  status: "draft" | "pending" | "approved" | "issued" | "rejected";
  requestedOn: string;
}
export interface IssueRegisterEntry {
  id: string;
  certNo: string;
  type: CertificateType;
  studentName: string;
  issuedOn: string;
  signatory: string;
  status: "issued" | "reissued" | "cancelled";
}

/* ---------- Communication & operations ---------- */
export interface Notice {
  id: string;
  title: string;
  audience: string;
  status: "draft" | "published";
  publishedOn: string | null;
  author: string;
  body?: string;
}
export interface CalendarEvent {
  id: string;
  date: string;
  title: string;
  kind: "holiday" | "exam" | "event" | "meeting";
  audience: string;
}
export interface LeaveRequest {
  id: string;
  staffName: string;
  from: string;
  to: string;
  type: string;
  status: "pending" | "approved" | "rejected";
}
export interface Approval {
  id: string;
  kind: string;
  subject: string;
  requestedBy: string;
  requestedOn: string;
  status: "pending" | "approved" | "rejected";
}
export interface EventPlan {
  id: string;
  name: string;
  date: string;
  owner: string;
  budget: number;
  status: "planning" | "confirmed" | "done";
}
export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  copies: number;
  available: number;
}
export interface Loan {
  id: string;
  book: string;
  member: string;
  issued: string;
  due: string;
  status: "issued" | "overdue" | "returned";
}
export interface Vehicle {
  id: string;
  regNo: string;
  route: string;
  driver: string;
  capacity: number;
  status: "active" | "maintenance";
}
export interface TransportRoute {
  id: string;
  name: string;
  stops: number;
  students: number;
  vehicle: string;
}
export interface ParentQuery {
  id: string;
  parent: string;
  subject: string;
  assignedTo: string;
  status: "open" | "in_progress" | "resolved";
  openedOn: string;
}
export interface ExamEntry {
  id: string;
  date: string;
  subject: string;
  classSection: string;
  kind: string;
  room: string;
}

/* ---------- Teacher workspace ---------- */
export interface TeachingClass {
  id: string;
  label: string;
  subject: string;
  period: string;
  time: string;
  room: string;
  studentCount: number;
}
export interface RosterStudent {
  id: string;
  name: string;
  rollNo: number;
}
export type AttendanceMark = "present" | "absent" | "late";
export interface AttendanceSheet {
  classId: string;
  classLabel: string;
  date: string;
  status: "draft" | "submitted";
  roster: RosterStudent[];
  marks: Record<string, AttendanceMark>;
}
export interface Homework {
  id: string;
  classId: string;
  classLabel: string;
  subject: string;
  title: string;
  instructions: string;
  due: string;
  status: "draft" | "published";
  submitted: number;
  total: number;
}
export interface HomeworkInput {
  classId: string;
  title: string;
  instructions: string;
  due: string;
  publish: boolean;
}
export interface MarksSheet {
  classId: string;
  classLabel: string;
  subject: string;
  assessment: string;
  maxMarks: number;
  status: "draft" | "submitted";
  roster: RosterStudent[];
  marks: Record<string, number | null>;
}
export interface TimetableSlot {
  period: string;
  time: string;
  subject: string;
  classLabel: string;
  room: string;
  teacher?: string;
}
export interface TeacherHome {
  greetingName: string;
  classesToday: number;
  nextAttendanceClassId: string | null;
  pending: { id: string; label: string; href: string }[];
  notices: { id: string; title: string }[];
}

/* ---------- Parent / student ---------- */
export interface Child {
  id: string;
  name: string;
  classSection: string;
  rollNo: number;
}
export interface ResultRow {
  subject: string;
  assessment: string;
  marks: number;
  max: number;
  grade: string;
}
export interface HomeworkItem {
  id: string;
  subject: string;
  title: string;
  due: string;
  status: "pending" | "submitted" | "reviewed";
}
export interface AttendanceSummary {
  presentDays: number;
  absentDays: number;
  lateDays: number;
  recent: { date: string; status: AttendanceMark }[];
}
export interface PtmSlot {
  id: string;
  teacher: string;
  date: string;
  time: string;
  booked: boolean;
}
export interface DailyBriefing {
  headline: string;
  items: { id: string; text: string; kind: "homework" | "fee" | "notice" | "event" }[];
}

/* ---------- Dashboards ---------- */
export interface Stat {
  label: string;
  value: string;
  hint?: string;
}
export interface SchoolDashboard {
  stats: Stat[];
  attendanceByWing: { label: string; pct: number }[];
  pendingApprovals: Approval[];
  upcoming: CalendarEvent[];
}
export interface PlatformDashboard {
  stats: Stat[];
  tenantsByStatus: { label: string; count: number }[];
  recentAudit: AuditEntry[];
  status: ServiceStatus[];
}

/* ---------- Academic-year rollover ---------- */
export interface RolloverCheck {
  id: string;
  label: string;
  state: "ok" | "warning" | "blocking";
  detail: string;
}
export interface PromotionRules {
  minAttendancePct: number;
  minOverallPct: number;
  conditionalPromotion: boolean;
}
export interface PromotionPreviewRow {
  id: string;
  studentName: string;
  from: string;
  outcome: "promote" | "detain" | "exception";
  to: string;
  note: string;
}
export interface SectionPlan {
  className: string;
  sections: { name: string; capacity: number; assigned: number }[];
}
export interface RolloverSubmission {
  rules: PromotionRules;
  acknowledgedWarnings: boolean;
  confirmText: string;
}
export interface RolloverResult extends MutationResult {
  /** The frontend cannot execute a rollover; the backend must authorise and run it. */
  state: "awaiting_backend_authorization";
}

export interface OnboardingItem {
  id: string;
  tenant: string;
  stage: string;
  progressPct: number;
  owner: string;
  status: "on_track" | "blocked" | "done";
}
