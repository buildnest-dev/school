import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** GET: the school's campuses with their student counts and the person in charge. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant(["school_owner", "principal"]);
  const [campuses, head, students] = await Promise.all([
    prisma.campus.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.membership.findFirst({
      where: { tenantId, role: "principal" },
      include: { user: { select: { name: true } } },
    }),
    prisma.student.findMany({
      where: { tenantId, status: "active" },
      select: { section: { select: { class: { select: { campusId: true } } } } },
    }),
  ]);
  const count = new Map<string, number>();
  for (const s of students) {
    const id = s.section?.class.campusId;
    if (id) count.set(id, (count.get(id) ?? 0) + 1);
  }
  const items = campuses.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address ?? "",
    students: count.get(c.id) ?? 0,
    principal: head?.user.name ?? "",
    status: "active" as const,
  }));
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});
