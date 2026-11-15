import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, dayOf, dayStr, isoDay, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** The school's view of the meeting slots, with who booked each. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...ADMIN]);
  const rows = await prisma.ptmSlot.findMany({
    where: { tenantId },
    orderBy: [{ date: "asc" }, { time: "asc" }],
  });
  return NextResponse.json(
    listOf(
      rows.map((s) => ({
        id: s.id,
        teacher: s.teacherName,
        date: dayStr(s.date),
        time: s.time,
        bookedBy: s.bookedByName ?? "",
      })),
    ),
  );
});

const Body = z.object({
  teacherName: z.string().trim().min(2).max(80),
  date: isoDay,
  time: z.string().trim().min(2).max(20),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN]);
  const b = Body.parse(await req.json());
  const s = await prisma.ptmSlot.create({
    data: { tenantId, teacherName: b.teacherName, date: dayOf(b.date), time: b.time },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: s.id, message: "Slot added." },
    { status: 201 },
  );
});
