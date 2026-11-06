import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { handle } from "@/server/http";
import { daySlots, staffOf } from "@/server/portal";

/** GET: today's periods for the signed-in teacher, in bell order. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const me = await staffOf(tenantId, user.id);
  if (!me) return NextResponse.json([]);
  const slots = await daySlots(tenantId, { staffId: me.id });
  return NextResponse.json(
    slots.map((s) => ({
      period: s.period,
      time: s.time,
      subject: s.subject,
      classLabel: s.classLabel,
      room: s.room,
    })),
  );
});
