import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { TR_MANAGE } from "@/server/transport";

type Ctx = { params: Promise<{ studentId: string }> };

async function view(tenantId: string, studentId: string) {
  const t = await prisma.studentTransport.findUnique({
    where: { studentId },
    include: { route: { include: { vehicle: true, driver: true } }, stop: true },
  });
  if (!t || t.tenantId !== tenantId) return { uses: false as const };
  return {
    uses: true as const,
    route: { id: t.route.id, name: t.route.name, attendant: t.route.attendantName },
    stop: {
      id: t.stop.id,
      name: t.stop.name,
      pickupTime: t.stop.pickupTime,
      dropTime: t.stop.dropTime,
    },
    vehicle: t.route.vehicle ? { regNo: t.route.vehicle.regNo, type: t.route.vehicle.type } : null,
    driver: t.route.driver ? { name: t.route.driver.name, phone: t.route.driver.phone } : null,
    monthlyFee: t.route.monthlyFeePaise / 100,
  };
}

/** A student's bus details. Transport staff see any student; a parent only their own child. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant([...TR_MANAGE, "parent"]);
  const { studentId } = await ctx.params;
  const s = await prisma.student.findFirst({
    where: {
      id: studentId,
      tenantId,
      ...(user.role === "parent" ? { guardian: { userId: user.id } } : {}),
    },
  });
  if (!s) throw new HttpError(404, "not_found", "Student not found.");
  return NextResponse.json({ studentId, name: s.name, ...(await view(tenantId, studentId)) });
});

const Body = z.union([
  z.object({ routeId: z.string().min(1), stopId: z.string().min(1) }),
  z.object({ routeId: z.null() }),
]);

/**
 * Puts a student on a route stop (or moves them), or takes them off with { routeId: null }.
 * The route must be active, have a vehicle with valid papers, and a free seat.
 */
export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...TR_MANAGE]);
  const { studentId } = await ctx.params;
  const body = Body.parse(await req.json());
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenantId, status: "active" },
  });
  if (!student) throw new HttpError(404, "not_found", "Student not found.");

  if (body.routeId === null) {
    await prisma.studentTransport.deleteMany({ where: { studentId, tenantId } });
  } else {
    const route = await prisma.transportRoute.findFirst({
      where: { id: body.routeId, tenantId },
      include: { vehicle: true },
    });
    if (!route) throw new HttpError(422, "bad_route", "Unknown route.");
    if (route.status !== "active")
      throw new HttpError(409, "inactive", "This route is not running.");
    if (!route.vehicle) throw new HttpError(409, "no_vehicle", "This route has no vehicle yet.");
    const stop = await prisma.routeStop.findFirst({
      where: { id: body.stopId, routeId: route.id, tenantId },
    });
    if (!stop) throw new HttpError(422, "bad_stop", "That stop is not on this route.");
    const { capacity } = route.vehicle;
    await prisma.$transaction(async (tx) => {
      const others = await tx.studentTransport.count({
        where: { routeId: route.id, NOT: { studentId } },
      });
      if (others >= capacity)
        throw new HttpError(409, "full", `${route.vehicle!.regNo} is full (${capacity} seats).`);
      await tx.studentTransport.upsert({
        where: { studentId },
        update: { routeId: route.id, stopId: stop.id },
        create: { tenantId, studentId, routeId: route.id, stopId: stop.id },
      });
    });
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "transport.assign",
      entity: "student",
      entityId: studentId,
    },
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: body.routeId === null ? "Removed from transport." : "Transport saved.",
    ...(await view(tenantId, studentId)),
  });
});
