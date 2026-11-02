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

function listService<K extends ResourceKey>(key: K): ListService<ResourceMap[K]> {
  const path = RESOURCE_PATHS[key];
  return {
    list: (p: ListParams = {}) =>
      apiRequest<Page<ResourceMap[K]>>(path, {
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
      }),
    get: (id) => apiRequest<ResourceMap[K] | null>(`${path}/${encodeURIComponent(id)}`),
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
      create: (input) => post(e.certificateRequests, input),
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
