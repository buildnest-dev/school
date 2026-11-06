import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";
import { daySlots } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

/** GET: today's periods for the class. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  if (!child.sectionId) return NextResponse.json([]);
  const slots = await daySlots(tenantId, { sectionId: child.sectionId });
  return NextResponse.json(
    slots.map((s) => ({
      period: s.period,
      time: s.time,
      subject: s.subject,
      classLabel: s.classLabel,
      room: s.room,
      teacher: s.teacher,
    })),
  );
});
