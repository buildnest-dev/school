import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { clearDemoData, loadDemoData } from "@/server/demo-data";
import { assertSameOrigin, handle } from "@/server/http";

export const maxDuration = 60;

/** POST: fills the demonstration school with sample data. Refused for any other school. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  try {
    const counts = await loadDemoData(tenantId, user.id, user.name);
    return NextResponse.json({ ok: true, ...counts }, { status: 201 });
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // Only the demo school can reach this point (loadDemoData refuses others), so the detail is safe.
    throw new HttpError(
      500,
      "demo_failed",
      e instanceof Error ? e.message.slice(0, 600) : "failed",
    );
  }
});

/** DELETE: clears the demonstration school's sample data again. */
export const DELETE = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant(["school_owner", "principal"]);
  return NextResponse.json({ ok: true, ...(await clearDemoData(tenantId)) });
});
