import { env } from "@/config/env";
import { createApiServices } from "./api";
import { createMockServices } from "./mock";
import type { Services } from "./types";

/** Picks the adapter from NEXT_PUBLIC_DATA_SOURCE. UI code only ever sees the `Services` interface. */
export function createServices(): Services {
  return env.dataSource === "api" ? createApiServices() : createMockServices();
}

export type { Services } from "./types";
