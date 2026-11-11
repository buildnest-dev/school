import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { isUnique, TR_MANAGE, vehicleFields, vehicleView } from "@/server/transport";

/** Fleet, each vehicle with its route and a compliance flag (ok / expiring within 30 days / expired / unknown). */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...TR_MANAGE]);
  const rows = await prisma.vehicle.findMany({
    where: { tenantId },
    orderBy: { regNo: "asc" },
    include: { routes: { select: { id: true, name: true, driver: { select: { name: true } } } } },
  });
  const items = rows.map(vehicleView);
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...TR_MANAGE]);
  const b = vehicleFields.parse(await req.json());
  try {
    const v = await prisma.vehicle.create({
      data: {
        tenantId,
        regNo: b.regNo,
        type: b.type,
        capacity: b.capacity,
        insuranceExpiry: b.insuranceExpiry ? new Date(`${b.insuranceExpiry}T00:00:00.000Z`) : null,
        fitnessExpiry: b.fitnessExpiry ? new Date(`${b.fitnessExpiry}T00:00:00.000Z`) : null,
      },
    });
    await prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "transport.vehicle",
        entity: "vehicle",
        entityId: v.id,
      },
    });
    return NextResponse.json(
      { ok: true, mode: "api", message: "Vehicle added.", vehicle: vehicleView(v) },
      { status: 201 },
    );
  } catch (e) {
    if (isUnique(e))
      throw new HttpError(
        409,
        "duplicate",
        "A vehicle with this registration number already exists.",
      );
    throw e;
  }
});
