import { env } from "@/config/env";
import { isDemoHost } from "@/config/demo";
import { NOT_BUILT, createApiServices } from "./api";
import { createMockServices } from "./mock";
import type { Services } from "./types";

/** Picks the adapter from NEXT_PUBLIC_DATA_SOURCE. UI code only ever sees the `Services` interface. */
export function createServices(): Services {
  if (env.dataSource !== "api") return createMockServices();
  const api = createApiServices();
  if (!isDemoHost()) return api;
  // The demonstration school: what has no backend yet runs on sample data.
  const mock = createMockServices();
  return {
    ...api,
    resource: (key) => (NOT_BUILT.has(key) ? mock.resource(key) : api.resource(key)),
    approvals: mock.approvals,
    certificates: { ...api.certificates, verify: mock.certificates.verify },
    rollover: mock.rollover,
    leave: mock.leave,
    teacher: { ...api.teacher, leaves: mock.teacher.leaves },
    family: {
      ...api.family,
      exams: mock.family.exams,
      ptmSlots: mock.family.ptmSlots,
      bookPtm: mock.family.bookPtm,
    },
  };
}

export type { Services } from "./types";
