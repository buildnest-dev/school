import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, dayOf, dayStr, isoDay, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...ADMIN]);
  const rows = await prisma.examSlot.findMany({ where: { tenantId }, orderBy: { date: "asc" } });
  return NextResponse.json(
    listOf(
      rows.map((x) => ({
        id: x.id,
        date: dayStr(x.date),
        subject: x.subject,
        classSection: x.classSection,
        kind: x.kind,
        room: x.room,
      })),
    ),
  );
});

const Body = z.object({
  date: isoDay,
  subject: z.string().trim().min(2).max(60),
  classSection: z.string().trim().min(1).max(40),
  kind: z.string().trim().min(2).max(30).default("Written"),
  room: z.string().trim().max(30).default(""),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN]);
  const b = Body.parse(await req.json());
  const x = await prisma.examSlot.create({
    data: { tenantId, ...b, date: dayOf(b.date) },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: x.id, message: "Added to the datesheet." },
    { status: 201 },
  );
});
