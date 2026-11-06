import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { tenantDb } from "@/server/db";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  const { tenantId } = await requireTenant([
    "school_owner",
    "principal",
    "vice_principal",
    "teacher",
    "accountant",
  ]);
  const classes = await tenantDb(tenantId).classes.list();
  return NextResponse.json(
    classes.map((c) => ({
      id: c.id,
      name: c.name,
      stage: c.stage,
      sections: c.sections.map((s) => ({ id: s.id, name: s.name })),
      subjects: c.subjects.map((s) => ({ id: s.id, name: s.name })),
    })),
  );
});
