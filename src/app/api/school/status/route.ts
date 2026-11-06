import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { goLiveChecklist, hostsFor } from "@/server/platform";
import { effectiveSubscription } from "@/server/subscription";

/** GET: the school's own status, subscription and setup checklist (for the owner and principal). */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant(["school_owner", "principal"]);
  const t = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  return NextResponse.json({
    name: t.name,
    status: t.status,
    plan: t.plan,
    subscription: effectiveSubscription(t),
    periodEnd: t.periodEnd?.toISOString().slice(0, 10) ?? null,
    hosts: hostsFor(t.slug),
    checklist: await goLiveChecklist(tenantId),
  });
});
