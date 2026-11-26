import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request facts that deep helpers (like requireTenant) need without every route passing them in. */
export const requestContext = new AsyncLocalStorage<{ method: string; path: string }>();

/** The request path after /api, for example "/fees/heads". */
export const currentPath = () => requestContext.getStore()?.path ?? "";

export const isWrite = () => {
  const m = requestContext.getStore()?.method ?? "GET";
  return !["GET", "HEAD", "OPTIONS"].includes(m);
};
