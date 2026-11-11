import { ApiError, apiRequest } from "@/lib/api/client";
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
  Record<
    ResourceKey,
    {
      path?: string;
      keep?: (r: Raw) => boolean;
      /** Turns the table's filters into the query this endpoint understands (default: filter[name]). */
      query?: (f: Record<string, string>) => Record<string, string>;
      row: (r: Raw) => unknown;
    }
  >
> = {
  staff: {
    query: (f): Record<string, string> => (f.status ? { status: f.status } : {}),
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
    query: (f): Record<string, string> => ({
      ...(f.status ? { status: f.status === "issued" ? "open" : f.status } : {}),
    }),
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
  tenants: {
    path: "/platform/schools",
    query: (f): Record<string, string> => ({
      ...(f.status
        ? {
            status:
              f.status === "active" ? "live" : f.status === "trial" ? "provisioned" : f.status,
          }
        : {}),
      ...(f.plan ? { plan: f.plan.toLowerCase() } : {}),
    }),
    row: (r) => ({
      id: r.id,
      name: r.name,
      plan: str(r.plan).replace(/^./, (c) => c.toUpperCase()),
      status: r.status === "live" ? "active" : r.status === "provisioned" ? "trial" : r.status,
      subscription: r.subscription,
      campuses: num(r.campuses),
      students: num(r.activeStudents),
      studentLimit: num(r.maxStudents),
      createdAt: r.createdAt,
    }),
  },
  onboarding: {
    path: "/platform/provisioning-requests",
    query: (f): Record<string, string> => ({
      ...(f.status
        ? {
            status:
              f.status === "done"
                ? "provisioned"
                : f.status === "blocked"
                  ? "rejected"
                  : "requested,verifying,approved",
          }
        : {}),
    }),
    row: (r) => ({
      id: r.id,
      tenant: str(r.organisation),
      stage: str(r.status).replace(/^./, (c) => c.toUpperCase()),
      progressPct:
        { requested: 10, verifying: 40, approved: 70, provisioned: 100 }[str(r.status)] ?? 0,
      owner: str(r.contactEmail),
      status:
        r.status === "provisioned" ? "done" : r.status === "rejected" ? "blocked" : "on_track",
    }),
  },
  support: {
    path: "/platform/tickets",
    query: (f): Record<string, string> => ({
      ...(f.status ? { status: f.status === "in_progress" ? "pending" : f.status } : {}),
      ...(f.priority ? { priority: f.priority } : {}),
    }),
    row: (r) => ({
      id: r.id,
      tenant: str(obj(r.school).name),
      subject: str(r.subject),
      priority: str(r.priority),
      status: r.status === "pending" ? "in_progress" : r.status,
      openedOn: r.createdAt,
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
    query: (f) => ({
      ...(f.status ? { status: f.status === "pending" ? "requested" : f.status } : {}),
      ...(f.type ? { type: f.type.toLowerCase() } : {}),
    }),
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
    query: (f): Record<string, string> => (f.status ? { status: f.status } : {}),
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

/**
 * Parts of the product whose backend is not built yet. They say so plainly instead of failing with a
 * "404". Each needs its own tables and rules (see docs/NOT_CONNECTED.md).
 */
const notBuilt = () =>
  Promise.reject(
    new ApiError(404, { code: "not_available", message: "This part is not available yet." }),
  );
export const NOT_BUILT = new Set<ResourceKey>([
  "vendors",
  "calendar",
  "leaves",
  "approvals",
  "eventPlans",
  "queries",
  "exams",
  "feeHeads",
]);

function listService<K extends ResourceKey>(key: K): ListService<ResourceMap[K]> {
  if (NOT_BUILT.has(key)) return { list: notBuilt, get: notBuilt } as ListService<ResourceMap[K]>;
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
          ...(a?.query
            ? a.query(p.filters ?? {})
            : Object.fromEntries(
                Object.entries(p.filters ?? {}).map(([k, v]) => [`filter[${k}]`, v]),
              )),
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

/** The subject a teacher teaches in a class, so marks and homework go to the right subject. */
async function subjectFor(classId: string): Promise<string | undefined> {
  const mine = await apiRequest<{ id: string; subjectId: string | null }[]>("/teacher/classes");
  return mine.find((c) => c.id === classId)?.subjectId ?? undefined;
}

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
      leaves: async () => [],
    },
    attendance: {
      getSheet: (classId, date) => apiRequest(e.attendanceSheet(classId, date)),
      save: (classId, date, marks, submit) =>
        put(e.attendanceSheet(classId, date), { marks, submit }),
    },
    homework: {
      list: async () => {
        const page = await apiRequest<Page<Raw>>(e.homework);
        return page.items.map((h) => ({
          id: str(h.id),
          classId: str(h.sectionId),
          classLabel: str(h.classSection),
          subject: str(h.subject),
          title: str(h.title),
          instructions: str(h.description),
          due: str(h.dueOn),
          status: h.status === "published" ? ("published" as const) : ("draft" as const),
          submitted: num(h.done),
          total: num(h.total),
        }));
      },
      create: async (input) =>
        post(e.homework, {
          sectionId: input.classId,
          subjectId: await subjectFor(input.classId),
          title: input.title,
          description: input.instructions,
          dueOn: input.due,
          publish: input.publish,
        }),
    },
    marks: {
      getSheet: async (classId) =>
        apiRequest(e.marksSheet(classId), { query: { subjectId: await subjectFor(classId) } }),
      save: async (classId, marks, submit) =>
        put(`${e.marksSheet(classId)}?subjectId=${await subjectFor(classId)}`, { marks, submit }),
    },
    notices: { create: (input) => post(e.notices, input) },
    leave: { request: (input) => post(e.leaveRequests, input) },
    approvals: { decide: () => notBuilt() },
    certificates: {
      create: (input) =>
        post("/certificates", {
          studentId: input.studentId,
          type: input.type.toLowerCase(),
          purpose: input.purpose,
        }),
      verify: () => notBuilt(),
    },
    rollover: {
      checks: () => notBuilt(),
      preview: () => notBuilt(),
      sections: () => notBuilt(),
      submit: () => notBuilt(),
    },
    family: {
      // The screens print "Class <classSection>", so the backend's "Class 8 A" drops its prefix.
      children: async () =>
        (await apiRequest<Raw[]>(e.familyChildren)).map((c) => ({
          id: str(c.id),
          name: str(c.name),
          classSection: str(c.classSection).replace(/^Class\s+/, ""),
          rollNo: num(c.rollNo),
        })),
      briefing: (id) => apiRequest(e.child(id, "briefing")),
      attendance: (id) => apiRequest(e.child(id, "attendance")),
      homework: (id) => apiRequest(e.child(id, "homework")),
      results: (id) => apiRequest(e.child(id, "results")),
      ledger: (id) => apiRequest(e.child(id, "ledger")),
      timetable: (id) => apiRequest(e.child(id, "timetable")),
      exams: async () => [],
      ptmSlots: async () => [],
      bookPtm: () => notBuilt(),
      requestCertificate: (childId, type, purpose) =>
        post("/certificates", { studentId: childId, type: type.toLowerCase(), purpose }),
      certificateRequests: async (childId) => {
        const page = await apiRequest<Page<Raw>>("/certificates", {
          query: { studentId: childId },
        });
        return page.items.map(
          (r) => ADAPT.certificateRequests!.row(r) as import("@/types").CertificateRequest,
        );
      },
    },
  };
}
