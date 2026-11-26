import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma, tenantDb } from "@/server/db";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  const { tenantId } = await requireTenant([
    "school_owner",
    "principal",
    "vice_principal",
    "admission_officer",
    "teacher",
    "accountant",
  ]);
  const classes = await tenantDb(tenantId).classes.list();
  const counts = await prisma.student.groupBy({
    by: ["sectionId"],
    where: { tenantId, status: "active", sectionId: { not: null } },
    _count: { _all: true },
  });
  const inSection = new Map(counts.map((c) => [c.sectionId, c._count._all]));
  return NextResponse.json(
    classes.map((c) => ({
      id: c.id,
      name: c.name,
      stage: c.stage,
      sections: c.sections.map((s) => ({
        id: s.id,
        name: s.name,
        students: inSection.get(s.id) ?? 0,
      })),
      subjects: c.subjects.map((s) => ({ id: s.id, name: s.name })),
    })),
  );
});
