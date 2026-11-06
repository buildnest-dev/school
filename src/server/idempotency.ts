import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { HttpError } from "./auth";
import { prisma } from "./db";

type Result = { status: number; body: unknown };

/**
 * Runs a write once per Idempotency-Key. Sending the same key again returns the stored answer
 * (marked with an Idempotent-Replayed header); the same key with a different body is refused; the
 * same key while the first request is still running is refused instead of doing the work twice.
 * Without the header the work simply runs.
 */
export async function idempotent(
  req: Request,
  scope: string,
  operation: string,
  requestBody: unknown,
  run: () => Promise<Result>,
): Promise<Response> {
  const key = req.headers.get("idempotency-key");
  if (!key) {
    const r = await run();
    return NextResponse.json(r.body, { status: r.status });
  }
  if (key.length < 8 || key.length > 100)
    throw new HttpError(
      422,
      "bad_idempotency_key",
      "Use an Idempotency-Key of 8 to 100 characters.",
    );
  const requestHash = createHash("sha256").update(JSON.stringify(requestBody)).digest("hex");
  const where = { scope_operation_key: { scope, operation, key } };

  try {
    await prisma.idempotencyKey.create({ data: { scope, operation, key, requestHash } });
  } catch (e) {
    if ((e as { code?: string }).code !== "P2002") throw e;
    const prior = await prisma.idempotencyKey.findUniqueOrThrow({ where });
    if (prior.requestHash !== requestHash)
      throw new HttpError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This Idempotency-Key was already used with a different request.",
      );
    if (prior.status === 0)
      throw new HttpError(409, "IN_PROGRESS", "The first request with this key is still running.");
    return NextResponse.json(JSON.parse(prior.responseJson), {
      status: prior.status,
      headers: { "Idempotent-Replayed": "true" },
    });
  }

  try {
    const r = await run();
    await prisma.idempotencyKey.update({
      where,
      data: { status: r.status, responseJson: JSON.stringify(r.body) },
    });
    return NextResponse.json(r.body, { status: r.status });
  } catch (e) {
    // The work failed, so let the caller retry with the same key.
    await prisma.idempotencyKey.delete({ where }).catch(() => undefined);
    throw e;
  }
}
