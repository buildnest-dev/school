import { z } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { dayField, dayStr, todayIST } from "./homework";

/** Who runs transport: the owner, principal and the transport in-charge. */
export const TR_MANAGE = ["school_owner", "principal", "transport"] as const;

/** Indian registration number, e.g. KA01AB1234 or MH12A1234 (spaces and hyphens ignored). */
export function normaliseReg(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(s) ? s : null;
}

export const regField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normaliseReg(v);
    if (!n)
      ctx.addIssue({
        code: "custom",
        message: "Enter a valid registration number, e.g. KA01AB1234",
      });
    return n ?? "";
  });

export const timeField = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

export const vehicleFields = z.object({
  regNo: regField,
  type: z.enum(["bus", "van"]),
  capacity: z.number().int().min(1).max(80),
  insuranceExpiry: dayField.optional(),
  fitnessExpiry: dayField.optional(),
});

export type Compliance = "ok" | "expiring" | "expired" | "unknown";

/** Insurance and fitness certificates: expired beats expiring (within 30 days) beats ok. */
export function compliance(
  v: { insuranceExpiry: Date | null; fitnessExpiry: Date | null },
  today = todayIST(),
): Compliance {
  const dates = [v.insuranceExpiry, v.fitnessExpiry];
  if (dates.some((d) => d === null)) return "unknown";
  const days = dates.map((d) => Math.round((d!.getTime() - Date.parse(today)) / 86400_000));
  const worst = Math.min(...days);
  return worst < 0 ? "expired" : worst <= 30 ? "expiring" : "ok";
}

/** A vehicle may only serve a route with valid papers. */
export function assertRoadworthy(v: {
  regNo: string;
  status: string;
  insuranceExpiry: Date | null;
  fitnessExpiry: Date | null;
}) {
  if (v.status !== "active")
    throw new HttpError(422, "vehicle_inactive", `${v.regNo} is not in service.`);
  const c = compliance(v);
  if (c === "expired" || c === "unknown")
    throw new HttpError(
      409,
      "vehicle_papers",
      `${v.regNo} has expired or missing insurance/fitness papers.`,
    );
}

export const vehicleView = (v: {
  id: string;
  regNo: string;
  type: string;
  capacity: number;
  insuranceExpiry: Date | null;
  fitnessExpiry: Date | null;
  status: string;
  routes?: { id: string; name: string }[];
}) => ({
  id: v.id,
  regNo: v.regNo,
  type: v.type,
  capacity: v.capacity,
  insuranceExpiry: v.insuranceExpiry ? dayStr(v.insuranceExpiry) : null,
  fitnessExpiry: v.fitnessExpiry ? dayStr(v.fitnessExpiry) : null,
  compliance: compliance(v),
  status: v.status,
  route: v.routes?.[0] ?? null,
});

export const routeInclude = {
  vehicle: true,
  driver: true,
  stops: { orderBy: { sequence: "asc" as const } },
  _count: { select: { riders: true } },
} as const;

export async function routeOr404(tenantId: string, id: string) {
  const r = await prisma.transportRoute.findFirst({
    where: { id, tenantId },
    include: routeInclude,
  });
  if (!r) throw new HttpError(404, "not_found", "Route not found.");
  return r;
}

type RouteRow = Awaited<ReturnType<typeof routeOr404>>;

export const routeView = (r: RouteRow) => ({
  id: r.id,
  name: r.name,
  status: r.status,
  monthlyFee: r.monthlyFeePaise / 100,
  attendant: r.attendantName,
  vehicle: r.vehicle
    ? { id: r.vehicle.id, regNo: r.vehicle.regNo, capacity: r.vehicle.capacity }
    : null,
  driver: r.driver ? { id: r.driver.id, name: r.driver.name, phone: r.driver.phone } : null,
  students: r._count.riders,
  seatsLeft: r.vehicle ? r.vehicle.capacity - r._count.riders : null,
  stops: r.stops.map((s) => ({
    id: s.id,
    name: s.name,
    sequence: s.sequence,
    pickupTime: s.pickupTime,
    dropTime: s.dropTime,
  })),
});

/** A driver must be an active staff member of this school with the driver role. */
export async function activeDriverOr422(tenantId: string, staffId: string) {
  const d = await prisma.staff.findFirst({ where: { id: staffId, tenantId } });
  if (!d || d.role !== "driver" || d.status !== "active")
    throw new HttpError(422, "not_driver", "Choose an active driver from the staff list.");
  return d;
}

export const isUnique = (e: unknown) => (e as { code?: string }).code === "P2002";

export const routeFields = z.object({
  name: z.string().trim().min(2).max(60),
  vehicleId: z.string().min(1).nullable().optional(),
  driverId: z.string().min(1).nullable().optional(),
  attendantName: z.string().trim().max(80).optional(),
  monthlyFee: z.number().min(0).max(100000).optional(),
});

/** Checks the vehicle (in service, valid papers) and the driver (active driver of this school). */
export async function checkResources(
  tenantId: string,
  b: { vehicleId?: string | null; driverId?: string | null },
) {
  if (b.vehicleId) {
    const v = await prisma.vehicle.findFirst({ where: { id: b.vehicleId, tenantId } });
    if (!v) throw new HttpError(422, "bad_vehicle", "Unknown vehicle.");
    assertRoadworthy(v);
  }
  if (b.driverId) await activeDriverOr422(tenantId, b.driverId);
}
