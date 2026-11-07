import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** GET: the signed-in person's latest notifications, newest first. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const rows = await prisma.appNotification.findMany({
    where: { tenantId, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    body: r.body,
    url: r.url,
    at: r.createdAt.toISOString(),
  }));
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});
