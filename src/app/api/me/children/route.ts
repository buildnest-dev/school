import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** Children of the signed-in parent: only students whose guardian record is linked to this login. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["parent"]);
  const kids = await prisma.student.findMany({
    where: { tenantId, status: "active", guardian: { userId: user.id } },
    orderBy: { name: "asc" },
    include: { section: { include: { class: true } } },
  });
  return NextResponse.json(
    kids.map((s, i) => ({
      id: s.id,
      name: s.name,
      classSection: s.section ? `${s.section.class.name} ${s.section.name}` : "Unassigned",
      rollNo: i + 1,
    })),
  );
});
