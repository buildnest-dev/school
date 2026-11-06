import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/**
 * A parent's linked children, or a student's own record. Only students whose guardian record (or
 * own login) is linked to this session are ever returned.
 */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const kids = await prisma.student.findMany({
    where: {
      tenantId,
      status: "active",
      ...(user.role === "parent" ? { guardian: { userId: user.id } } : { userId: user.id }),
    },
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
