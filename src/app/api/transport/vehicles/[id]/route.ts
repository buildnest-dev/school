import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { isUnique, TR_MANAGE, vehicleFields, vehicleView } from "@/server/transport";

const Patch = vehicleFields
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() })
  .strict();

/**
 * Edit a vehicle. Capacity cannot drop below the students already riding its route; taking it out
 * of service is refused while it still serves a route; renewing papers is always allowed.
 */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...TR_MANAGE]);
  const { id } = await ctx.params;
  const cur = await prisma.vehicle.findFirst({
    where: { id, tenantId },
    include: { routes: { include: { _count: { select: { riders: true } } } } },
  });
  if (!cur) throw new HttpError(404, "not_found", "Vehicle not found.");
  const b = Patch.parse(await req.json());
  const route = cur.routes[0];

  if (b.capacity !== undefined && route && b.capacity < route._count.riders)
    throw new HttpError(
      409,
      "capacity",
      `${route._count.riders} students ride on ${route.name}; capacity cannot be lower.`,
    );
  if (b.status === "inactive" && route)
    throw new HttpError(
      409,
      "in_use",
      `This vehicle serves ${route.name}; assign another vehicle first.`,
    );

  const { insuranceExpiry, fitnessExpiry, ...rest } = b;
  try {
    const v = await prisma.vehicle.update({
      where: { id },
      data: {
        ...rest,
        ...(insuranceExpiry
          ? { insuranceExpiry: new Date(`${insuranceExpiry}T00:00:00.000Z`) }
          : {}),
        ...(fitnessExpiry ? { fitnessExpiry: new Date(`${fitnessExpiry}T00:00:00.000Z`) } : {}),
      },
      include: { routes: { select: { id: true, name: true } } },
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "transport.vehicle.update",
        entity: "vehicle",
        entityId: id,
      },
    });
    return NextResponse.json({
      ok: true,
      mode: "api",
      message: "Vehicle updated.",
      vehicle: vehicleView(v),
    });
  } catch (e) {
    if (isUnique(e))
      throw new HttpError(
        409,
        "duplicate",
        "Another vehicle already has this registration number.",
      );
    throw e;
  }
});
