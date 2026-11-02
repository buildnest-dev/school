import type {
  Approval,
  AttendanceMark,
  AttendanceSheet,
  AttendanceSummary,
  AuditEntry,
  Book,
  CalendarEvent,
  Campus,
  CertificateRequest,
  CertificateType,
  Child,
  DailyBriefing,
  Enquiry,
  EventPlan,
  ExamEntry,
  FeeHead,
  Homework,
  HomeworkInput,
  HomeworkItem,
  Invoice,
  IssueRegisterEntry,
  LeaveRequest,
  LedgerEntry,
  ListParams,
  Loan,
  MarksSheet,
  MutationResult,
  Notice,
  OnboardingItem,
  Page,
  ParentQuery,
  PlatformDashboard,
  PromotionPreviewRow,
  PromotionRules,
  PtmSlot,
  ResultRow,
  Role,
  RolloverCheck,
  RolloverResult,
  RolloverSubmission,
  SchoolDashboard,
  SectionPlan,
  Staff,
  Student,
  SupportRequest,
  TeacherHome,
  TeachingClass,
  Tenant,
  TimetableSlot,
  TransportRoute,
  Vehicle,
  Vendor,
} from "@/types";

/** Every list-style screen reads through this contract. */
export interface ListService<T> {
  list(params?: ListParams): Promise<Page<T>>;
  get(id: string): Promise<T | null>;
}

/** Resource key → row type. Add a key here, then register it in `resources.ts`. */
export interface ResourceMap {
  students: Student;
  staff: Staff;
  enquiries: Enquiry;
  campuses: Campus;
  invoices: Invoice;
  feeHeads: FeeHead;
  vendors: Vendor;
  certificateRequests: CertificateRequest;
  issueRegister: IssueRegisterEntry;
  notices: Notice;
  calendar: CalendarEvent;
  leaves: LeaveRequest;
  approvals: Approval;
  eventPlans: EventPlan;
  queries: ParentQuery;
  books: Book;
  loans: Loan;
  vehicles: Vehicle;
  routes: TransportRoute;
  exams: ExamEntry;
  tenants: Tenant;
  onboarding: OnboardingItem;
  support: SupportRequest;
  audit: AuditEntry;
}
export type ResourceKey = keyof ResourceMap;

export interface NoticeInput {
  title: string;
  body: string;
  audience: string;
  publish: boolean;
}
export interface LeaveInput {
  from: string;
  to: string;
  type: string;
  reason: string;
}
export interface CertificateInput {
  type: CertificateType;
  studentId: string;
  purpose: string;
}
export interface CertificateVerification {
  valid: boolean;
  summary?: string;
}

/**
 * The full service surface used by the UI. `mock` implements it in memory (development only);
 * `api` implements it against the backend (proposed endpoints in docs/API_INTEGRATION.md).
 */
export interface Services {
  mode: "mock" | "api";
  resource<K extends ResourceKey>(key: K): ListService<ResourceMap[K]>;
  dashboards: {
    school(role: Role): Promise<SchoolDashboard>;
    platform(): Promise<PlatformDashboard>;
  };
  platform: {
    status(): Promise<
      { name: string; state: "operational" | "degraded" | "unavailable"; note: string }[]
    >;
  };
  ledger: { forStudent(studentId: string): Promise<LedgerEntry[]> };
  teacher: {
    home(): Promise<TeacherHome>;
    classes(): Promise<TeachingClass[]>;
    timetable(): Promise<TimetableSlot[]>;
    syllabus(): Promise<{ classLabel: string; subject: string; pct: number }[]>;
    leaves(): Promise<LeaveRequest[]>;
  };
  attendance: {
    getSheet(classId: string, date: string): Promise<AttendanceSheet | null>;
    save(
      classId: string,
      date: string,
      marks: Record<string, AttendanceMark>,
      submit: boolean,
    ): Promise<MutationResult>;
  };
  homework: {
    list(): Promise<Homework[]>;
    create(input: HomeworkInput): Promise<MutationResult>;
  };
  marks: {
    getSheet(classId: string): Promise<MarksSheet | null>;
    save(
      classId: string,
      marks: Record<string, number | null>,
      submit: boolean,
    ): Promise<MutationResult>;
  };
  notices: { create(input: NoticeInput): Promise<MutationResult> };
  leave: { request(input: LeaveInput): Promise<MutationResult> };
  approvals: {
    decide(id: string, decision: "approved" | "rejected", note?: string): Promise<MutationResult>;
  };
  certificates: {
    create(input: CertificateInput): Promise<MutationResult>;
    verify(certNo: string): Promise<CertificateVerification>;
  };
  rollover: {
    checks(): Promise<RolloverCheck[]>;
    preview(rules: PromotionRules): Promise<PromotionPreviewRow[]>;
    sections(): Promise<SectionPlan[]>;
    submit(input: RolloverSubmission): Promise<RolloverResult>;
  };
  family: {
    children(): Promise<Child[]>;
    briefing(childId: string): Promise<DailyBriefing>;
    attendance(childId: string): Promise<AttendanceSummary>;
    homework(childId: string): Promise<HomeworkItem[]>;
    results(childId: string): Promise<ResultRow[]>;
    ledger(childId: string): Promise<LedgerEntry[]>;
    timetable(childId: string): Promise<TimetableSlot[]>;
    exams(childId: string): Promise<ExamEntry[]>;
    ptmSlots(): Promise<PtmSlot[]>;
    bookPtm(slotId: string): Promise<MutationResult>;
    requestCertificate(
      childId: string,
      type: CertificateType,
      purpose: string,
    ): Promise<MutationResult>;
    certificateRequests(childId: string): Promise<CertificateRequest[]>;
  };
}
