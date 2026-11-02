import { env } from "@/config/env";
import type { ApiErrorBody } from "@/types";

/** Error thrown for any non-2xx response. `fieldErrors` is populated for HTTP 422 validation errors. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string[]>;
  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? `Request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code ?? "unknown";
    this.fieldErrors = body.fieldErrors;
  }
}

export type Query = Record<string, string | number | boolean | undefined | null>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  query?: Query;
  body?: unknown;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Query) {
  const base = env.apiBaseUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query))
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

/**
 * Thin fetch wrapper for the real backend. Assumptions (see docs/API_INTEGRATION.md):
 * - Session is an HTTP-only cookie managed by the backend (`credentials: "include"`); no tokens in JS.
 * - The tenant is derived from the session on the server, never trusted from a client header.
 * - JSON in, JSON out. Errors follow `ApiErrorBody`.
 */
export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new ApiError(0, {
      code: "not_configured",
      message: "NEXT_PUBLIC_API_BASE_URL is not set.",
    });
  }
  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? "GET",
    credentials: "include",
    headers: opts.body
      ? { "Content-Type": "application/json", Accept: "application/json" }
      : { Accept: "application/json" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
  if (!res.ok) {
    let body: Partial<ApiErrorBody> = {};
    try {
      body = (await res.json()) as Partial<ApiErrorBody>;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
