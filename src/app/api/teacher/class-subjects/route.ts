import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { writablePairs } from "@/server/classwork";
import { handle } from "@/server/http";

/** The (class, subject) pairs the signed-in teacher may share work with. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  return NextResponse.json(await writablePairs(tenantId, user.id));
});
