import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { routeInclude, routeOr404, routeView, TR_MANAGE, timeField } from "@/server/transport";

const Body = z.object({
  stops: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(60),
        pickupTime: timeField,
        dropTime: timeField.optional(),
      }),
    )
    .min(1)
    .max(30),
});

/**
 * Replaces the stop list in travel order. Pickup times must increase along the route and names
 * must be unique. A stop that students use cannot be removed.
 */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...TR_MANAGE]);
  const { id } = await ctx.params;
  const route = await routeOr404(tenantId, id);
  const { stops } = Body.parse(await req.json());

  const names = new Set<string>();
  let prev = "";
  for (const s of stops) {
    const key = s.name.toLowerCase();
    if (names.has(key)) throw new HttpError(422, "duplicate", `${s.name} is listed twice.`);
    names.add(key);
    if (s.pickupTime <= prev)
      throw new HttpError(422, "order", `${s.name}: pickup times must increase along the route.`);
    prev = s.pickupTime;
  }

  const existing = await prisma.routeStop.findMany({
    where: { routeId: id },
    include: { _count: { select: { riders: true } } },
  });
  const keep = new Map(stops.map((s) => [s.name.toLowerCase(), s]));
  const removed = existing.filter((e) => !keep.has(e.name.toLowerCase()));
  const used = removed.find((e) => e._count.riders > 0);
  if (used)
    throw new HttpError(
      409,
      "stop_in_use",
      `${used.name} has students; move them before removing it.`,
    );

  await prisma.$transaction([
    prisma.routeStop.deleteMany({ where: { routeId: id, id: { in: removed.map((r) => r.id) } } }),
    ...stops.map((s, i) => {
      const match = existing.find((e) => e.name.toLowerCase() === s.name.toLowerCase());
      return match
        ? prisma.routeStop.update({
            where: { id: match.id },
            data: {
              name: s.name,
              sequence: i + 1,
              pickupTime: s.pickupTime,
              dropTime: s.dropTime ?? null,
            },
          })
        : prisma.routeStop.create({
            data: {
              tenantId,
              routeId: id,
              name: s.name,
              sequence: i + 1,
              pickupTime: s.pickupTime,
              dropTime: s.dropTime ?? null,
            },
          });
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "transport.stops",
        entity: "route",
        entityId: route.id,
      },
    }),
  ]);
  const fresh = await prisma.transportRoute.findFirstOrThrow({
    where: { id },
    include: routeInclude,
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Stops saved.",
    route: routeView(fresh),
  });
});
