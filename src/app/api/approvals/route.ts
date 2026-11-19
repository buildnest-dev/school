import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, dayStr, listOf } from "@/server/extras";
import { handle } from "@/server/http";

const nice = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** The approval inbox: today it holds staff leave requests waiting for a decision. */
export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...ADMIN]);
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
        subject: `${l.type.charAt(0).toUpperCase()}${l.type.slice(1)} leave, ${nice(l.fromDate)}${
          dayStr(l.fromDate) === dayStr(l.toDate) ? "" : ` to ${nice(l.toDate)}`
        }`,
        requestedBy: l.staffName,
        requestedOn: dayStr(l.createdAt),
        status: l.status,
      })),
    ),
  );
});
