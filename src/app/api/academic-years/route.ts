import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { handle } from "@/server/http";

/** Academic years of this school, newest first. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant(["school_owner", "principal", "teacher", "accountant"]);
  const rows = await prisma.academicYear.findMany({
    where: { tenantId },
    orderBy: { startsOn: "desc" },
  });
  const items = rows.map((y) => ({
    id: y.id,
    label: y.label,
    startsOn: dayStr(y.startsOn),
    endsOn: dayStr(y.endsOn),
    current: y.current,
  }));
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});
