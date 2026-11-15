import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN_FIN, dayStr, listOf } from "@/server/extras";
import { handle } from "@/server/http";

/** The approval inbox: today it holds staff leave requests waiting for a decision. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...ADMIN_FIN]);
  const status = new URL(req.url).searchParams.get("filter[status]");
  const rows = await prisma.leaveRequest.findMany({
    where: { tenantId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(
    listOf(
      rows.map((l) => ({
        id: l.id,
        kind: "Leave",
        subject: `${l.type} leave, ${dayStr(l.fromDate)} to ${dayStr(l.toDate)}`,
        requestedBy: l.staffName,
        requestedOn: dayStr(l.createdAt),
        status: l.status,
      })),
    ),
  );
});
