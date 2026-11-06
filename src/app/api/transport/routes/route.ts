import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import {
  checkResources,
  isUnique,
  routeFields,
  routeInclude,
  routeView,
  TR_MANAGE,
} from "@/server/transport";

export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...TR_MANAGE]);
  const rows = await prisma.transportRoute.findMany({
    where: { tenantId },
    orderBy: { name: "asc" },
    include: routeInclude,
  });
  const items = rows.map(routeView);
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...TR_MANAGE]);
  const b = routeFields.parse(await req.json());
  await checkResources(tenantId, b);
  try {
    const r = await prisma.transportRoute.create({
      data: {
        tenantId,
        name: b.name,
        vehicleId: b.vehicleId ?? null,
        driverId: b.driverId ?? null,
        attendantName: b.attendantName,
        monthlyFeePaise: Math.round((b.monthlyFee ?? 0) * 100),
      },
      include: routeInclude,
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "transport.route",
        entity: "route",
        entityId: r.id,
      },
    });
    return NextResponse.json(
      { ok: true, mode: "api", message: "Route added.", route: routeView(r) },
      { status: 201 },
    );
  } catch (e) {
    if (isUnique(e))
      throw new HttpError(
        409,
        "duplicate",
        "A route with this name exists, or the vehicle/driver already serves another route.",
      );
    throw e;
  }
});
