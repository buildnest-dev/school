import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

/** GET: the datesheet entries for the child's class, from today on. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  const label = child.section ? `${child.section.class.name} ${child.section.name}` : null;
  if (!label) return NextResponse.json([]);
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
  const rows = await prisma.examSlot.findMany({
    where: { tenantId, classSection: label, date: { gte: today } },
    orderBy: { date: "asc" },
  });
  return NextResponse.json(
    rows.map((x) => ({
      id: x.id,
      date: dayStr(x.date),
      subject: x.subject,
      classSection: x.classSection,
      kind: x.kind,
      room: x.room,
    })),
  );
});
