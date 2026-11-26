import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { TR_MANAGE } from "@/server/transport";

/** GET: students who asked for the bus and have no seat yet, with the routes that can take them. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...TR_MANAGE]);
  const [students, routes] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, status: "active", needsBus: true, transport: { is: null } },
      include: { section: { include: { class: true } } },
      orderBy: { admissionNo: "asc" },
    }),
    prisma.transportRoute.findMany({
      where: { tenantId, status: "active", vehicleId: { not: null } },
      include: { stops: { orderBy: { sequence: "asc" } } },
      orderBy: { name: "asc" },
    }),
  ]);
  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      classSection: s.section ? `${s.section.class.name} ${s.section.name}` : "Unassigned",
      address: s.address,
    })),
    routes: routes.map((r) => ({
      id: r.id,
      name: r.name,
      stops: r.stops.map((x) => ({ id: x.id, name: x.name })),
    })),
  });
});
