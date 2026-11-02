/**
 * ⚠ DEVELOPMENT-ONLY mock adapter. It keeps data in memory for the current browser tab and loses it
 * on reload. It is not a backend, performs no authorization and never persists anything.
 * Every write returns `mode: "mock"` so the UI can say so.
 */
import { DEV_TODAY } from "@/config/env";
import * as D from "@/mocks/data";
import type {
  AttendanceMark,
  AttendanceSheet,
  CertificateRequest,
  Child,
  DailyBriefing,
  Homework,
  LeaveRequest,
  ListParams,
  MarksSheet,
  MutationResult,
  Notice,
  Page,
  PromotionPreviewRow,
  PtmSlot,
  Role,
  SchoolDashboard,
  Stat,
} from "@/types";
import type { ListService, ResourceKey, ResourceMap, Services } from "../types";

const LATENCY_MS = process.env.NODE_ENV === "test" ? 0 : 250;
const wait = <T>(value: T): Promise<T> =>
  LATENCY_MS ? new Promise((r) => setTimeout(() => r(value), LATENCY_MS)) : Promise.resolve(value);
const mock = (message: string, id?: string): MutationResult => ({
  ok: true,
  mode: "mock",
  id,
  message,
});
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const money = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

/* ---------- Generic list resources ---------- */
const rows: { [K in ResourceKey]: ResourceMap[K][] } = {
  students: clone(D.STUDENTS),
  staff: clone(D.STAFF),
  enquiries: clone(D.ENQUIRIES),
  campuses: clone(D.CAMPUSES),
  invoices: clone(D.INVOICES),
  feeHeads: clone(D.FEE_HEADS),
  vendors: clone(D.VENDORS),
  certificateRequests: clone(D.CERT_REQUESTS),
  issueRegister: clone(D.ISSUE_REGISTER),
  notices: clone(D.NOTICES),
  calendar: clone(D.CALENDAR),
  leaves: clone(D.LEAVES),
  approvals: clone(D.APPROVALS),
  eventPlans: clone(D.EVENT_PLANS),
  queries: clone(D.QUERIES),
  books: clone(D.BOOKS),
  loans: clone(D.LOANS),
  vehicles: clone(D.VEHICLES),
  routes: clone(D.ROUTES),
  exams: clone(D.EXAMS),
  tenants: clone(D.TENANTS),
  onboarding: clone(D.ONBOARDING),
  support: clone(D.SUPPORT),
  audit: clone(D.AUDIT),
};

function listService<K extends ResourceKey>(key: K): ListService<ResourceMap[K]> {
  return {
    async list(p: ListParams = {}): Promise<Page<ResourceMap[K]>> {
      let items = (rows[key] as ResourceMap[K][]).slice();
      const q = p.q?.trim().toLowerCase();
      if (q)
        items = items.filter((r) =>
          Object.values(r as object).some((v) => String(v).toLowerCase().includes(q)),
        );
      for (const [f, v] of Object.entries(p.filters ?? {})) {
        if (v)
          items = items.filter((r) => String((r as unknown as Record<string, unknown>)[f]) === v);
      }
      if (p.sort) {
        const k = p.sort;
        const dir = p.order === "desc" ? -1 : 1;
        items.sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[k];
          const bv = (b as unknown as Record<string, unknown>)[k];
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
          return String(av).localeCompare(String(bv), undefined, { numeric: true }) * dir;
        });
      }
      const pageSize = p.pageSize ?? 10;
      const page = Math.max(1, p.page ?? 1);
      return wait({
        items: clone(items.slice((page - 1) * pageSize, page * pageSize)),
        total: items.length,
        page,
        pageSize,
      });
    },
    async get(id) {
      const r = (rows[key] as { id: string }[]).find((x) => x.id === id);
      return wait(r ? (clone(r) as ResourceMap[K]) : null);
    },
  };
}

/* ---------- In-memory stores for writes ---------- */
const attendanceStore = new Map<
  string,
  { marks: Record<string, AttendanceMark>; status: "draft" | "submitted" }
>();
const marksStore = new Map<
  string,
  { marks: Record<string, number | null>; status: "draft" | "submitted" }
>();
const homeworkStore: Homework[] = [
  {
    id: "hw1",
    classId: "8A",
    classLabel: "Class 8A",
    subject: "English",
    title: "Write a letter to the editor",
    instructions: "150–200 words. Use formal format.",
    due: "2026-10-29",
    status: "published",
    submitted: 9,
    total: 14,
  },
  {
    id: "hw2",
    classId: "6A",
    classLabel: "Class 6A",
    subject: "English",
    title: "Poem recitation practice",
    instructions: "Learn the first two stanzas.",
    due: "2026-10-30",
    status: "published",
    submitted: 3,
    total: 14,
  },
  {
    id: "hw3",
    classId: "9B",
    classLabel: "Class 9B",
    subject: "English",
    title: "Chapter 4 questions",
    instructions: "Answer questions 1 to 6.",
    due: "2026-11-02",
    status: "draft",
    submitted: 0,
    total: 14,
  },
];
const familyCertStore: CertificateRequest[] = [];
const ptmBooked = new Set<string>(D.PTM_SLOTS.filter((s) => s.booked).map((s) => s.id));
const teacherLeaves: LeaveRequest[] = D.LEAVES.filter((l) => l.staffName === "Kavita Iyer").map(
  (l) => ({ ...l }),
);

const classOf = (id: string) => D.TEACHER_CLASSES.find((c) => c.id === id);

/* ---------- Rollover helpers ---------- */
function nextClass(from: string): string {
  const n = parseInt(from, 10);
  const sec = from.replace(/^\d+/, "");
  return n >= 12 ? "Graduating" : `${n + 1}${sec}`;
}
function previewRows(rules: {
  minAttendancePct: number;
  minOverallPct: number;
  conditionalPromotion: boolean;
}): PromotionPreviewRow[] {
  return D.STUDENTS.slice(0, 24).map((s, i) => {
    const overall = 42 + ((i * 17) % 54);
    let outcome: PromotionPreviewRow["outcome"] = "promote";
    let note = "Meets promotion rules";
    if (s.attendancePct < rules.minAttendancePct) {
      outcome = "exception";
      note = `Attendance ${s.attendancePct}% is below ${rules.minAttendancePct}%: needs a decision`;
    } else if (overall < rules.minOverallPct) {
      outcome = rules.conditionalPromotion ? "exception" : "detain";
      note = rules.conditionalPromotion
        ? `Overall ${overall}%: conditional promotion`
        : `Overall ${overall}% is below ${rules.minOverallPct}%`;
    }
    const to = outcome === "detain" ? s.classSection : nextClass(s.classSection);
    return { id: s.id, studentName: s.name, from: s.classSection, outcome, to, note };
  });
}

export function createMockServices(): Services {
  const today = DEV_TODAY;
  return {
    mode: "mock",
    resource: (key) => listService(key),

    dashboards: {
      async school(role: Role): Promise<SchoolDashboard> {
        const pending = rows.approvals.filter((a) => a.status === "pending");
        const overdue = rows.invoices.filter((i) => i.status === "overdue");
        const collected = rows.invoices.reduce((s, i) => s + i.paid, 0);
        const stats: Stat[] =
          role === "accountant"
            ? [
                { label: "Collected today (sample)", value: "₹68,500", hint: "18 receipts" },
                {
                  label: "Overdue invoices",
                  value: String(overdue.length),
                  hint: "Needs follow-up",
                },
                {
                  label: "Collected this term (sample)",
                  value: money(collected * 40),
                  hint: "of ₹52.0L due",
                },
                {
                  label: "Pending approvals",
                  value: String(pending.filter((a) => a.kind === "Fee concession").length),
                  hint: "Fee concessions",
                },
              ]
            : role === "librarian"
              ? [
                  { label: "Books in catalogue", value: String(rows.books.length) },
                  {
                    label: "On loan",
                    value: String(rows.loans.filter((l) => l.status !== "returned").length),
                  },
                  {
                    label: "Overdue",
                    value: String(rows.loans.filter((l) => l.status === "overdue").length),
                    hint: "Send reminders",
                  },
                  {
                    label: "Out of stock",
                    value: String(rows.books.filter((b) => b.available === 0).length),
                  },
                ]
              : role === "transport"
                ? [
                    {
                      label: "Vehicles active",
                      value: String(rows.vehicles.filter((v) => v.status === "active").length),
                      hint: `${rows.vehicles.length} in total`,
                    },
                    {
                      label: "In maintenance",
                      value: String(rows.vehicles.filter((v) => v.status === "maintenance").length),
                    },
                    { label: "Routes", value: String(rows.routes.length) },
                    {
                      label: "Students on transport",
                      value: String(rows.routes.reduce((s, r) => s + r.students, 0)),
                    },
                  ]
                : [
                    { label: "Enrollment", value: "1,248", hint: "+36 this term" },
                    { label: "Present today", value: "94.2%", hint: "4 classes pending" },
                    { label: "Fees collected", value: "₹38.6L", hint: "of ₹52.0L due" },
                    { label: "Pending approvals", value: String(pending.length) },
                  ];
        return wait({
          stats,
          attendanceByWing: [
            { label: "Primary", pct: 96 },
            { label: "Middle", pct: 93 },
            { label: "Secondary", pct: 91 },
            { label: "Sr. Secondary", pct: 95 },
          ],
          pendingApprovals: clone(pending).slice(0, 4),
          upcoming: clone(rows.calendar.filter((c) => c.date >= today)).slice(0, 4),
        });
      },
      async platform() {
        const t = rows.tenants;
        return wait({
          stats: [
            {
              label: "Schools",
              value: String(t.length),
              hint: `${t.filter((x) => x.status === "active").length} active`,
            },
            {
              label: "Students on platform (sample)",
              value: t.reduce((s, x) => s + x.students, 0).toLocaleString("en-IN"),
            },
            {
              label: "In onboarding",
              value: String(rows.onboarding.filter((o) => o.status !== "done").length),
            },
            {
              label: "Open support requests",
              value: String(rows.support.filter((s) => s.status !== "closed").length),
            },
          ],
          tenantsByStatus: (["active", "trial", "suspended"] as const).map((s) => ({
            label: s,
            count: t.filter((x) => x.status === s).length,
          })),
          recentAudit: clone(rows.audit).slice(0, 5),
          status: clone(D.SERVICE_STATUS),
        });
      },
    },
    platform: { status: () => wait(clone(D.SERVICE_STATUS)) },
    ledger: { forStudent: (id) => wait(D.ledgerFor(id)) },

    teacher: {
      async home() {
        const pending = D.TEACHER_CLASSES.filter(
          (c) => attendanceStore.get(`${c.id}|${today}`)?.status !== "submitted",
        ).map((c) => ({
          id: `att-${c.id}`,
          label: `Mark attendance: ${c.label}`,
          href: `/teacher/attendance/${c.id}`,
        }));
        const drafts = [...marksStore.entries()]
          .filter(([, v]) => v.status === "draft")
          .map(([k]) => ({
            id: `mk-${k}`,
            label: `Finish marks: Class ${k}`,
            href: `/teacher/marks/${k}`,
          }));
        const hw = homeworkStore
          .filter((h) => h.status === "draft")
          .map((h) => ({
            id: h.id,
            label: `Publish homework: ${h.title}`,
            href: "/teacher/homework",
          }));
        return wait({
          greetingName: "Kavita",
          classesToday: D.TEACHER_CLASSES.length,
          nextAttendanceClassId:
            D.TEACHER_CLASSES.find(
              (c) => attendanceStore.get(`${c.id}|${today}`)?.status !== "submitted",
            )?.id ?? null,
          pending: [...pending, ...drafts, ...hw].slice(0, 6),
          notices: clone(rows.notices.filter((n) => n.status === "published"))
            .slice(0, 3)
            .map((n) => ({ id: n.id, title: n.title })),
        });
      },
      classes: () => wait(clone(D.TEACHER_CLASSES)),
      timetable: () => wait(clone(D.TEACHER_TIMETABLE)),
      syllabus: () => wait(clone(D.SYLLABUS)),
      leaves: () => wait(clone(teacherLeaves)),
    },

    attendance: {
      async getSheet(classId, date): Promise<AttendanceSheet | null> {
        const c = classOf(classId);
        if (!c) return wait(null);
        const saved = attendanceStore.get(`${classId}|${date}`);
        return wait({
          classId,
          classLabel: c.label,
          date,
          status: saved?.status ?? "draft",
          roster: D.rosterFor(classId),
          marks: clone(saved?.marks ?? {}),
        });
      },
      async save(classId, date, marks, submit) {
        attendanceStore.set(`${classId}|${date}`, {
          marks: clone(marks),
          status: submit ? "submitted" : "draft",
        });
        return wait(
          mock(
            submit
              ? "Attendance recorded in the development mock (not stored on a server)."
              : "Draft kept in the development mock.",
          ),
        );
      },
    },

    homework: {
      list: () => wait(clone(homeworkStore)),
      async create(input) {
        const c = classOf(input.classId);
        const hw: Homework = {
          id: `hw${homeworkStore.length + 1}`,
          classId: input.classId,
          classLabel: c?.label ?? input.classId,
          subject: c?.subject ?? "English",
          title: input.title,
          instructions: input.instructions,
          due: input.due,
          status: input.publish ? "published" : "draft",
          submitted: 0,
          total: c?.studentCount ?? 14,
        };
        homeworkStore.unshift(hw);
        return wait(
          mock(
            input.publish
              ? "Homework published in the development mock."
              : "Draft saved in the development mock.",
            hw.id,
          ),
        );
      },
    },

    marks: {
      async getSheet(classId): Promise<MarksSheet | null> {
        const c = classOf(classId);
        if (!c) return wait(null);
        const saved = marksStore.get(classId);
        const roster = D.rosterFor(classId);
        return wait({
          classId,
          classLabel: c.label,
          subject: c.subject,
          assessment: "Unit Test 2",
          maxMarks: 50,
          status: saved?.status ?? "draft",
          roster,
          marks: clone(saved?.marks ?? Object.fromEntries(roster.map((r) => [r.id, null]))),
        });
      },
      async save(classId, marks, submit) {
        marksStore.set(classId, { marks: clone(marks), status: submit ? "submitted" : "draft" });
        return wait(
          mock(
            submit
              ? "Marks submitted in the development mock for review."
              : "Draft kept in the development mock.",
          ),
        );
      },
    },

    notices: {
      async create(input) {
        const n: Notice = {
          id: `n${rows.notices.length + 1}`,
          title: input.title,
          audience: input.audience,
          status: input.publish ? "published" : "draft",
          publishedOn: input.publish ? today : null,
          author: "You (dev)",
          body: input.body,
        };
        rows.notices.unshift(n);
        return wait(
          mock(
            input.publish
              ? "Notice published in the development mock. Nobody was notified."
              : "Draft saved in the development mock.",
            n.id,
          ),
        );
      },
    },
    leave: {
      async request(input) {
        const l: LeaveRequest = {
          id: `lv${rows.leaves.length + 1}`,
          staffName: "Kavita Iyer",
          from: input.from,
          to: input.to,
          type: input.type,
          status: "pending",
        };
        rows.leaves.unshift(l);
        teacherLeaves.unshift({ ...l });
        return wait(
          mock(
            "Leave request recorded in the development mock. No one has been asked to approve it.",
            l.id,
          ),
        );
      },
    },
    approvals: {
      async decide(id, decision) {
        const a = rows.approvals.find((x) => x.id === id);
        if (a) a.status = decision;
        return wait(mock(`Marked ${decision} in the development mock.`, id));
      },
    },
    certificates: {
      async create(input) {
        const s = rows.students.find((x) => x.id === input.studentId);
        const r: CertificateRequest = {
          id: `cr-${rows.certificateRequests.length + 1}`,
          type: input.type,
          studentName: s?.name ?? "Student",
          classSection: s?.classSection ?? "",
          requestedBy: "Office",
          status: "pending",
          requestedOn: today,
        };
        rows.certificateRequests.unshift(r);
        return wait(
          mock(
            "Certificate request created in the development mock. No document was generated.",
            r.id,
          ),
        );
      },
      async verify(certNo) {
        const e = rows.issueRegister.find(
          (r) => r.certNo.toLowerCase() === certNo.trim().toLowerCase(),
        );
        if (!e || e.status === "cancelled") return wait({ valid: false });
        return wait({
          valid: true,
          summary: `${e.type} certificate issued on ${e.issuedOn} by ${D.SCHOOL_NAME} (${e.status}).`,
        });
      },
    },

    rollover: {
      checks: () =>
        wait([
          {
            id: "c1",
            label: "Results published for all classes",
            state: "warning" as const,
            detail: "Class 10B and 12S results are still in draft.",
          },
          {
            id: "c2",
            label: "Pending approvals cleared",
            state: "warning" as const,
            detail: `${rows.approvals.filter((a) => a.status === "pending").length} approvals are still waiting.`,
          },
          {
            id: "c3",
            label: "Fee dues reviewed",
            state: "ok" as const,
            detail: "Outstanding dues will be carried forward with source-year links.",
          },
          {
            id: "c4",
            label: "Attendance registers closed",
            state: "ok" as const,
            detail: "All registers submitted.",
          },
          {
            id: "c5",
            label: "New-year fee plans configured",
            state: "blocking" as const,
            detail: "Classes 9 and 11 have no fee plan for 2026–27.",
          },
        ]),
      preview: (rules) => wait(previewRows(rules)),
      sections: () =>
        wait([
          {
            className: "Class 8",
            sections: [
              { name: "A", capacity: 40, assigned: 38 },
              { name: "B", capacity: 40, assigned: 35 },
              { name: "C", capacity: 40, assigned: 12 },
            ],
          },
          {
            className: "Class 9",
            sections: [
              { name: "A", capacity: 40, assigned: 40 },
              { name: "B", capacity: 40, assigned: 34 },
            ],
          },
          {
            className: "Class 10",
            sections: [
              { name: "A", capacity: 40, assigned: 37 },
              { name: "B", capacity: 40, assigned: 36 },
            ],
          },
        ]),
      async submit(input) {
        void input;
        return wait({
          ...mock(
            "Submitted in the development mock. The backend must authorise and run a real rollover.",
          ),
          state: "awaiting_backend_authorization" as const,
        });
      },
    },

    family: {
      children: () => wait<Child[]>(clone(D.CHILDREN)),
      async briefing(childId): Promise<DailyBriefing> {
        const c = D.CHILDREN.find((x) => x.id === childId);
        return wait({
          headline: `${c?.name.split(" ")[0] ?? "Your child"} today`,
          items: [
            { id: "b1", kind: "homework", text: "English homework is due tomorrow." },
            { id: "b2", kind: "fee", text: "Term 2 fee balance is ₹5,750 (due 31 Oct)." },
            { id: "b3", kind: "notice", text: "Unit Test 2 timetable has been published." },
            { id: "b4", kind: "event", text: "Parent meeting on 31 Oct. You can book a slot." },
          ],
        });
      },
      attendance: () =>
        wait({
          presentDays: 41,
          absentDays: 2,
          lateDays: 1,
          recent: [
            { date: "2026-10-26", status: "present" as const },
            { date: "2026-10-23", status: "present" as const },
            { date: "2026-10-22", status: "late" as const },
            { date: "2026-10-21", status: "present" as const },
            { date: "2026-10-20", status: "absent" as const },
          ],
        }),
      homework: () =>
        wait([
          {
            id: "h1",
            subject: "English",
            title: "Write a letter to the editor",
            due: "2026-10-27",
            status: "pending" as const,
          },
          {
            id: "h2",
            subject: "Maths",
            title: "Exercise 7.2 questions 1–10",
            due: "2026-10-28",
            status: "pending" as const,
          },
          {
            id: "h3",
            subject: "Science",
            title: "Diagram of the water cycle",
            due: "2026-10-24",
            status: "submitted" as const,
          },
          {
            id: "h4",
            subject: "Hindi",
            title: "Poem summary",
            due: "2026-10-20",
            status: "reviewed" as const,
          },
        ]),
      results: () => wait(clone(D.RESULTS)),
      ledger: (childId) => wait(D.ledgerFor(childId === "c-aarav" ? "st-012" : "st-005")),
      timetable: (childId) =>
        wait(
          childId === "c-aarav"
            ? clone(D.STUDENT_TIMETABLE)
            : D.STUDENT_TIMETABLE.map((s) => ({ ...s, classLabel: "Class 3A" })),
        ),
      exams: () => wait(clone(D.EXAMS)),
      ptmSlots: () =>
        wait<PtmSlot[]>(D.PTM_SLOTS.map((s) => ({ ...s, booked: ptmBooked.has(s.id) }))),
      async bookPtm(slotId) {
        ptmBooked.add(slotId);
        return wait(
          mock("Slot booked in the development mock. The teacher has not been told.", slotId),
        );
      },
      async requestCertificate(childId, type, purpose) {
        const c = D.CHILDREN.find((x) => x.id === childId);
        const r: CertificateRequest = {
          id: `fc-${familyCertStore.length + 1}`,
          type,
          studentName: c?.name ?? "",
          classSection: c?.classSection ?? "",
          requestedBy: "Parent",
          status: "pending",
          requestedOn: today,
        };
        void purpose;
        familyCertStore.unshift(r);
        return wait(
          mock("Request recorded in the development mock. The school has not received it.", r.id),
        );
      },
      certificateRequests: (childId) =>
        wait(
          clone(
            familyCertStore.filter(
              (r) => D.CHILDREN.find((c) => c.id === childId)?.name === r.studentName,
            ),
          ),
        ),
    },
  };
}
