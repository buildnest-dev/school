import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { checkStudentCsv } from "@/server/importer";

const Body = z.object({ csv: z.string().min(10) });

/**
 * POST: step 1 of a student import. The CSV is checked and nothing is saved except the checked
 * batch itself. The response lists problems line by line so the school can fix the file first.
 * Columns: name, dob, gender, class, section, guardian_name, guardian_relation, guardian_phone,
 * and optionally guardian_email, category, address.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "admission_officer",
  ]);
  const { csv } = Body.parse(await req.json());
  const r = await checkStudentCsv(tenantId, csv);
  const batch = await prisma.importBatch.create({
    data: {
      tenantId,
      kind: "students",
      createdBy: user.id,
      rowsJson: JSON.stringify(r.rows),
      errorsJson: JSON.stringify(r.errors),
    },
  });
  return NextResponse.json(
    {
      ok: true,
      mode: "api",
      batchId: batch.id,
      total: r.total,
      valid: r.rows.length,
      invalid: r.errors.length,
      errors: r.errors.slice(0, 100),
      sample: r.rows.slice(0, 5).map((x) => ({ line: x.line, name: x.name, dob: x.dob })),
      canCommit: r.rows.length > 0,
    },
    { status: 201 },
  );
});
