import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { handle } from "@/server/http";

/** A teacher's own leave requests, newest first. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const rows = await prisma.leaveRequest.findMany({
    where: { tenantId, userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    rows.map((l) => ({
      id: l.id,
      staffName: l.staffName,
      from: dayStr(l.fromDate),
      to: dayStr(l.toDate),
      type: l.type,
      status: l.status,
    })),
  );
});
