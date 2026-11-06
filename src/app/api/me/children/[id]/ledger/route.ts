import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";
import { studentLedger } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

/** GET: the fee ledger of one of the parent's own children. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  return NextResponse.json(await studentLedger(tenantId, child.id));
});
