import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";
import { requestContext } from "./context";

/** Wraps a route handler: maps HttpError / validation errors to the ApiErrorBody shape the frontend expects. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      const first = args[0];
      const method = first instanceof Request ? first.method : "GET";
      return await requestContext.run({ method }, () => fn(...args));
    } catch (e) {
      if (e instanceof HttpError)
        return NextResponse.json({ code: e.code, message: e.message }, { status: e.status });
      if (e instanceof ZodError) {
        const fieldErrors: Record<string, string[]> = {};
        for (const i of e.issues) (fieldErrors[i.path.join(".") || "_"] ??= []).push(i.message);
        return NextResponse.json(
          { code: "validation", message: "Please check the highlighted fields.", fieldErrors },
          { status: 422 },
        );
      }
      console.error(e);
      return NextResponse.json(
        { code: "server_error", message: "Something went wrong." },
        { status: 500 },
      );
    }
  };
}

/** CSRF guard for state-changing requests: if the browser sends an Origin it must match this host. */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  if (new URL(origin).host !== req.headers.get("host"))
    throw new HttpError(403, "bad_origin", "Cross-site request blocked.");
}

const attempts = new Map<string, { n: number; reset: number }>();
/** In-memory login throttle (5 tries / 10 min per key). A multi-instance deployment needs a shared store. */
export function throttle(key: string, max = 5, windowMs = 10 * 60_000) {
  const now = Date.now();
  const a = attempts.get(key);
  if (!a || a.reset < now) {
    attempts.set(key, { n: 1, reset: now + windowMs });
    return;
  }
  if (++a.n > max)
    throw new HttpError(429, "too_many_attempts", "Too many attempts. Try again later.");
}
export const clearThrottle = (key: string) => attempts.delete(key);
