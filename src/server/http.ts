import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";
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
      if (e instanceof SyntaxError && /JSON/i.test(e.message))
        return NextResponse.json(
          { code: "bad_json", message: "The request could not be read." },
          { status: 400 },
        );
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

/**
 * Attempt limiter kept in the database so every server instance shares one count (an in-memory
 * counter would reset on each serverless start). By default 5 tries per 10 minutes for a key.
 */
export async function throttle(key: string, max = 5, windowMs = 10 * 60_000) {
  const now = new Date();
  const count = await prisma.$transaction(async (tx) => {
    const a = await tx.rateLimit.findUnique({ where: { key } });
    if (!a || a.resetAt < now) {
      await tx.rateLimit.upsert({
        where: { key },
        create: { key, count: 1, resetAt: new Date(now.getTime() + windowMs) },
        update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
      });
      return 1;
    }
    return (await tx.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } })).count;
  });
  if (count > max)
    throw new HttpError(429, "too_many_attempts", "Too many attempts. Try again later.");
}
export const clearThrottle = async (key: string) => {
  await prisma.rateLimit.deleteMany({ where: { key } });
};
