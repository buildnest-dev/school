import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import {
  checkResources,
  isUnique,
  routeFields,
  routeInclude,
  routeOr404,
  routeView,
  TR_MANAGE,
} from "@/server/transport";

type Ctx = { params: Promise<{ id: string }> };

/** One route with its stops and the students who ride it. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId } = await requireTenant([...TR_MANAGE]);
  const { id } = await ctx.params;
  const r = await routeOr404(tenantId, id);
  const riders = await prisma.studentTransport.findMany({
    where: { tenantId, routeId: id },
    include: {
      student: { include: { section: { include: { class: true } } } },
      stop: true,
    },
    orderBy: { stop: { sequence: "asc" } },
  });
  return NextResponse.json({
    ...routeView(r),
    riders: riders.map((x) => ({
      studentId: x.studentId,
      name: x.student.name,
      classSection: x.student.section
        ? `${x.student.section.class.name} ${x.student.section.name}`
        : "Unassigned",
      stopId: x.stopId,
      stop: x.stop.name,
    })),
  });
});

const Patch = routeFields
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() })
  .strict();

/**
 * Edit a route. A new vehicle must have valid papers and enough seats for the students already
 * riding; a route with riders cannot be switched off.
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...TR_MANAGE]);
  const { id } = await ctx.params;
  const cur = await routeOr404(tenantId, id);
  const b = Patch.parse(await req.json());
  const riders = cur._count.riders;

  if (b.status === "inactive" && riders > 0)
    throw new HttpError(409, "has_riders", `${riders} students ride this route; move them first.`);
  await checkResources(tenantId, {
    vehicleId: b.vehicleId && b.vehicleId !== cur.vehicleId ? b.vehicleId : undefined,
    driverId: b.driverId && b.driverId !== cur.driverId ? b.driverId : undefined,
  });
  if (b.vehicleId) {
    const v = await prisma.vehicle.findFirst({ where: { id: b.vehicleId, tenantId } });
    if (v && v.capacity < riders)
      throw new HttpError(
        409,
        "capacity",
        `${v.regNo} seats ${v.capacity}; ${riders} students ride this route.`,
      );
  }
  if (b.vehicleId === null && riders > 0)
    throw new HttpError(409, "has_riders", "A route with riders must keep a vehicle.");

  const { monthlyFee, ...rest } = b;
  try {
    await prisma.transportRoute.update({
      where: { id },
      data: {
        ...rest,
        ...(monthlyFee !== undefined ? { monthlyFeePaise: Math.round(monthlyFee * 100) } : {}),
      },
    });
  } catch (e) {
    if (isUnique(e))
      throw new HttpError(
        409,
        "duplicate",
        "A route with this name exists, or the vehicle/driver already serves another route.",
      );
    throw e;
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "transport.route.update",
      entity: "route",
      entityId: id,
    },
  });
  const fresh = await prisma.transportRoute.findFirstOrThrow({
    where: { id },
    include: routeInclude,
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Route updated.",
    route: routeView(fresh),
  });
});
