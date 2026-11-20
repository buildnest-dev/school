import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { goLiveChecklist, requirePlatform } from "@/server/platform";

type Row = {
  id: string;
  tenant: string;
  stage: string;
  progressPct: number;
  owner: string;
  status: "on_track" | "blocked" | "done";
};

const REQUEST_PROGRESS: Record<string, number> = {
  requested: 10,
  verifying: 40,
  approved: 70,
  provisioned: 100,
};

/**
 * GET: schools being set up. A school added by the team (not yet live) shows with how much of the
 * go-live checklist is done; activation requests from sales show with their stage.
 * Filter with ?status=on_track|blocked|done.
 */
export const GET = handle(async (req: Request) => {
  await requirePlatform(["sales", "customer_success", "finance"]);
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim().toLowerCase();

  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ["provisioned", "suspended"] } },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { users: { where: { role: "school_owner" }, include: { user: true }, take: 1 } },
  });
  const schools: Row[] = await Promise.all(
    tenants.map(async (t) => {
      const checklist = await goLiveChecklist(t.id);
      const done = checklist.filter((c) => c.ok).length;
      const open = checklist.find((c) => !c.ok);
      return {
        id: t.id,
        tenant: t.name,
        stage: t.status === "suspended" ? "Suspended" : open ? open.label : "Ready to go live",
        progressPct: Math.round((done / checklist.length) * 100),
        owner: t.users[0]?.user.email ?? "",
        status: t.status === "suspended" ? "blocked" : "on_track",
      } satisfies Row;
    }),
  );

  const requests = await prisma.provisioningRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const fromRequests: Row[] = requests.map((r) => ({
    id: r.id,
    tenant: r.organisation,
    stage: r.status.replace(/^./, (c) => c.toUpperCase()),
    progressPct: REQUEST_PROGRESS[r.status] ?? 0,
    owner: r.contactEmail,
    status: r.status === "provisioned" ? "done" : r.status === "rejected" ? "blocked" : "on_track",
  }));

  const items = [...schools, ...fromRequests]
    .filter((r) => !status || r.status === status)
    .filter((r) => !q || `${r.tenant} ${r.stage} ${r.owner}`.toLowerCase().includes(q));
  return NextResponse.json({ items, total: items.length });
});
