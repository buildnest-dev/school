import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, STAFF_ROLES, dayOf, dayStr, isoDay, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** Everyone in the school sees the calendar; each person only sees events meant for them. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const isStaff = (STAFF_ROLES as readonly string[]).includes(user.role);
  const audience = isStaff
    ? undefined
    : { in: ["all", user.role === "parent" ? "parents" : "students"] };
  const rows = await prisma.calendarEvent.findMany({
    where: { tenantId, ...(audience ? { audience } : {}) },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(
    listOf(
      rows.map((e) => ({
        id: e.id,
        date: dayStr(e.date),
        title: e.title,
        kind: e.kind,
        audience: e.audience,
      })),
    ),
  );
});

const Body = z.object({
  date: isoDay,
  title: z.string().trim().min(2).max(120),
  kind: z.enum(["holiday", "exam", "event", "meeting"]),
  audience: z.enum(["all", "staff", "parents", "students"]).default("all"),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN]);
  const b = Body.parse(await req.json());
  const e = await prisma.calendarEvent.create({
    data: { tenantId, date: dayOf(b.date), title: b.title, kind: b.kind, audience: b.audience },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: e.id, message: "Added to the calendar." },
    { status: 201 },
  );
});
