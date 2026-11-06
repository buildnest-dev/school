import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/**
 * GET /api/audit-events?action=&entity=&from=YYYY-MM-DD&to=YYYY-MM-DD&page=&pageSize=
 * The school's own trail of sensitive changes (marks, fees, logins, imports, exports), newest first.
 */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant(["school_owner", "principal"]);
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(sp.get("pageSize") ?? 25) || 25));
  const day = (v: string | null, end: boolean) =>
    v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))
      ? new Date(`${v}T${end ? "23:59:59" : "00:00:00"}Z`)
      : undefined;
  const from = day(sp.get("from"), false);
  const to = day(sp.get("to"), true);
  const where = {
    tenantId,
    ...(sp.get("action") ? { action: { startsWith: sp.get("action")! } } : {}),
    ...(sp.get("entity") ? { entity: sp.get("entity")! } : {}),
    ...(from || to ? { at: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const ids = [...new Set(rows.map((r) => r.userId).filter((x): x is string => !!x))];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  const name = new Map(users.map((u) => [u.id, u.name]));
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      action: r.action,
      entity: r.entity,
      entityId: r.entityId,
      by: r.userId ? (name.get(r.userId) ?? null) : null,
    })),
    total,
    page,
    pageSize,
  });
});
