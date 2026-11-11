import { NextResponse } from "next/server";
import { z } from "zod";
import { strongPassword } from "@/server/accounts";
import { requireTenant } from "@/server/auth";
import { createDemoLogins } from "@/server/demo-data";
import { assertSameOrigin, handle } from "@/server/http";

/** POST {password}: makes one login per role in the demonstration school. Refused elsewhere. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant(["school_owner", "principal"]);
  const { password } = z.object({ password: strongPassword }).parse(await req.json());
  return NextResponse.json(
    { ok: true, ...(await createDemoLogins(tenantId, password)) },
    { status: 201 },
  );
});
