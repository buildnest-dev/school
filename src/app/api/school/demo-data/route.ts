import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { loadDemoData } from "@/server/demo-data";
import { assertSameOrigin, handle } from "@/server/http";

export const maxDuration = 60;

/** POST: fills the demonstration school with sample data. Refused for any other school. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const counts = await loadDemoData(tenantId, user.id, user.name);
  return NextResponse.json({ ok: true, ...counts }, { status: 201 });
});
