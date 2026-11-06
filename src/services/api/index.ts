import { apiRequest } from "@/lib/api/client";
import type { ListParams, MutationResult, Page } from "@/types";
import { ENDPOINTS, RESOURCE_PATHS } from "../endpoints";
import type { ListService, ResourceKey, ResourceMap, Services } from "../types";

/**
 * Real-backend adapter. Every call goes to a PROPOSED endpoint (see ../endpoints.ts and
 * docs/API_INTEGRATION.md). It is intentionally thin: the backend owns validation, authorization,
 * tenant isolation and business rules.
 */
const toMutation = (r: { id?: string; message?: string } | undefined): MutationResult => ({
  ok: true,
  mode: "api",
  id: r?.id,
  message: r?.message,
});

type Raw = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const obj = (v: unknown): Raw => (v && typeof v === "object" ? (v as Raw) : {});

const CERT_TYPE: Record<string, string> = {
  bonafide: "Bonafide",
  character: "Character",
  transfer: "Transfer",
};

/**
 * Where a resource lives on the real backend and how its rows become the shapes the screens use.
 * A resource not listed here is read from RESOURCE_PATHS as it is (students, invoices, notices,
 * enquiries and campuses already match).
 */
const ADAPT: Partial<
  Record<ResourceKey, { path?: string; keep?: (r: Raw) => boolean; row: (r: Raw) => unknown }>
> = {
  staff: {
    row: (r) => ({
      id: r.id,
      name: r.name,
      role: str(r.role),
      department: str(r.department) || str(r.designation),
      phone: str(r.phone),
      status: r.status === "active" ? "active" : "inactive",
      joined: str(r.joinedOn),
    }),
  },
  books: {
    row: (r) => ({
      id: r.id,
      title: r.title,
      author: r.author,
      isbn: str(r.isbn),
      copies: num(r.totalCopies),
      available: num(r.availableCopies),
    }),
  },
  loans: {
    row: (r) => ({
      id: r.id,
      book: r.title,
      member: r.borrower,
      issued: r.issuedOn,
      due: r.dueOn,
      status: r.returnedOn ? "returned" : r.status === "overdue" ? "overdue" : "issued",
    }),
  },
  vehicles: {
    row: (r) => ({
      id: r.id,
      regNo: r.regNo,
      route: str(obj(r.route).name),
      driver: "",
      capacity: num(r.capacity),
      status: r.status === "maintenance" ? "maintenance" : "active",
    }),
  },
  routes: {
    row: (r) => ({
      id: r.id,
      name: r.name,
      stops: Array.isArray(r.stops) ? r.stops.length : num(r.stops),
      students: num(r.students),
      vehicle: str(obj(r.vehicle).regNo),
    }),
  },
  audit: {
    row: (r) => ({
      id: r.id,
      at: r.at,
      actor: str(r.by) || "System",
      action: r.action,
      target: str(r.entity),
      area: str(r.entity),
    }),
  },
  certificateRequests: {
    path: "/certificates",
    row: (r) => ({
      id: r.id,
      type: CERT_TYPE[str(r.type)] ?? str(r.type),
      studentName: r.student,
      classSection: str(r.classSection),
      requestedBy: r.requestedBy,
      status:
        r.status === "requested" ? "pending" : r.status === "cancelled" ? "rejected" : r.status,
      requestedOn: r.requestedOn,
    }),
  },
  issueRegister: {
    path: "/certificates",
    keep: (r) => r.status === "issued" || r.status === "cancelled",
    row: (r) => ({
      id: r.id,
      certNo: str(r.serialNo),
      type: CERT_TYPE[str(r.type)] ?? str(r.type),
      studentName: r.student,
      issuedOn: str(r.issuedOn),
      signatory: str(r.issuedBy),
      status: r.status === "cancelled" ? "cancelled" : "issued",
    }),
  },
};

function listService<K extends ResourceKey>(key: K): ListService<ResourceMap[K]> {
  const a = ADAPT[key];
  const path = a?.path ?? RESOURCE_PATHS[key];
  const shape = (r: Raw) => (a ? a.row(r) : r) as ResourceMap[K];
  return {
    list: async (p: ListParams = {}) => {
      const page = await apiRequest<Page<Raw>>(path, {
        query: {
          q: p.q,
          page: p.page,
          pageSize: p.pageSize,
          sort: p.sort,
          order: p.order,
          ...Object.fromEntries(
            Object.entries(p.filters ?? {}).map(([k, v]) => [`filter[${k}]`, v]),
          ),
        },
      });
      const rows = a?.keep ? page.items.filter(a.keep) : page.items;
      return {
        ...page,
        items: rows.map(shape),
        total: a?.keep ? rows.length : (page.total ?? rows.length),
      };
    },
    get: async (id) => {
      const r = await apiRequest<Raw | null>(`${path}/${encodeURIComponent(id)}`);
      return r ? shape(r) : null;
    },
  };
}

const post = (path: string, body: unknown) =>
  apiRequest<{ id?: string; message?: string }>(path, { method: "POST", body }).then(toMutation);
const put = (path: string, body: unknown) =>
  apiRequest<{ id?: string; message?: string }>(path, { method: "PUT", body }).then(toMutation);

export function createApiServices(): Services {
  const e = ENDPOINTS;
  return {
    mode: "api",
    resource: (key) => listService(key),
    dashboards: {
      // The server decides the dashboard from the session role; the client never sends a role.
      school: () => apiRequest(e.dashboardSchool),
      platform: () => apiRequest(e.dashboardPlatform),
    },
    platform: { status: () => apiRequest(e.platformStatus) },
    ledger: { forStudent: (id) => apiRequest(e.studentLedger(id)) },
    teacher: {
      home: () => apiRequest(e.teacherHome),
      classes: () => apiRequest(e.teacherClasses),
      timetable: () => apiRequest(e.teacherTimetable),
      syllabus: () => apiRequest(e.teacherSyllabus),
      leaves: () => apiRequest(e.teacherLeaves),
    },
    attendance: {
      getSheet: (classId, date) => apiRequest(e.attendanceSheet(classId, date)),
      save: (classId, date, marks, submit) =>
        put(e.attendanceSheet(classId, date), { marks, submit }),
    },
    homework: { list: () => apiRequest(e.homework), create: (input) => post(e.homework, input) },
    marks: {
      getSheet: (classId) => apiRequest(e.marksSheet(classId)),
      save: (classId, marks, submit) => put(e.marksSheet(classId), { marks, submit }),
    },
    notices: { create: (input) => post(e.notices, input) },
    leave: { request: (input) => post(e.leaveRequests, input) },
    approvals: { decide: (id, decision, note) => post(e.approvalDecision(id), { decision, note }) },
    certificates: {
      create: (input) =>
        post("/certificates", {
          studentId: input.studentId,
          type: input.type.toLowerCase(),
          purpose: input.purpose,
        }),
      verify: (certNo) => apiRequest(e.certificateVerify(certNo)),
    },
    rollover: {
      checks: () => apiRequest(e.rolloverChecks),
      preview: (rules) => apiRequest(e.rolloverPreview, { method: "POST", body: rules }),
      sections: () => apiRequest(e.rolloverSections),
      submit: (input) => apiRequest(e.rolloverSubmit, { method: "POST", body: input }),
    },
    family: {
      children: () => apiRequest(e.familyChildren),
      briefing: (id) => apiRequest(e.child(id, "briefing")),
      attendance: (id) => apiRequest(e.child(id, "attendance")),
      homework: (id) => apiRequest(e.child(id, "homework")),
      results: (id) => apiRequest(e.child(id, "results")),
      ledger: (id) => apiRequest(e.child(id, "ledger")),
      timetable: (id) => apiRequest(e.child(id, "timetable")),
      exams: (id) => apiRequest(e.child(id, "exams")),
      ptmSlots: () => apiRequest(e.ptmSlots),
      bookPtm: (slotId) => post(e.ptmBook(slotId), {}),
      requestCertificate: (childId, type, purpose) =>
        post(e.child(childId, "certificate-requests"), { type, purpose }),
      certificateRequests: (childId) => apiRequest(e.child(childId, "certificate-requests")),
    },
  };
}
