/**
 * Runtime configuration. Only NEXT_PUBLIC_* values are available in the browser.
 * See .env.example. Never put secrets in NEXT_PUBLIC_* variables.
 */
export type DataSource = "mock" | "api";

export const env = {
  /** "mock" uses the development-only in-memory adapter. "api" calls NEXT_PUBLIC_API_BASE_URL. */
  dataSource: (process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock") as DataSource,
  /** Base URL of the backend API, e.g. https://api.example.invalid/v1 (placeholder only). */
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "",
};

/** Fixed "today" for the mock adapter so screens are deterministic. Real data uses the server date. */
export const DEV_TODAY = "2026-10-26";

/** "Today" as an ISO date: fixed in mock mode, the real date otherwise. */
export const todayIso = () =>
  env.dataSource === "mock" ? DEV_TODAY : new Date().toISOString().slice(0, 10);
