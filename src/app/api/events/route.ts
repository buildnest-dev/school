import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, dayOf, dayStr, isoDay, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...ADMIN]);
  const status = new URL(req.url).searchParams.get("filter[status]");
  const rows = await prisma.eventPlan.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(
    listOf(
      rows.map((e) => ({
        id: e.id,
        name: e.name,
        date: dayStr(e.date),
        owner: e.owner,
        budget: e.budget,
        status: e.status,
      })),
    ),
  );
});

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  date: isoDay,
  owner: z.string().trim().min(2).max(80),
  budget: z.coerce.number().int().min(0).max(100_000_000).default(0),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN]);
  const b = Body.parse(await req.json());
  const e = await prisma.eventPlan.create({
    data: { tenantId, name: b.name, date: dayOf(b.date), owner: b.owner, budget: b.budget },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: e.id, message: "Event added." },
    { status: 201 },
  );
});
