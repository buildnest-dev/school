import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";
import { ticketRow } from "@/server/support";

/** GET: every school's tickets for the support desk. Filter with ?status=, ?priority=, ?mine=1. */
export const GET = handle(async (req: Request) => {
  const { user } = await requirePlatform(["support", "customer_success"]);
  const sp = new URL(req.url).searchParams;
  const status = sp.get("status");
  const priority = sp.get("priority");
  const rows = await prisma.supportTicket.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(sp.get("mine") ? { assigneeId: user.id } : {}),
    },
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  const items = rows.map((t) => ({ ...ticketRow(t), school: t.tenant, assigneeId: t.assigneeId }));
  return NextResponse.json({ items, total: items.length });
});
