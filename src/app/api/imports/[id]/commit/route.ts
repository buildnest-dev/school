import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import type { ImportRow } from "@/server/importer";
import { nextAdmissionNo } from "@/server/students";

/**
 * POST: step 2. Creates the students from a checked batch, all or nothing. A batch can be
 * committed once; a second press (or a double click) is refused instead of adding everyone twice.
 * Only the rows that passed checking are added.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "admission_officer",
  ]);
  const { id } = await ctx.params;
  const batch = await prisma.importBatch.findFirst({ where: { id, tenantId, kind: "students" } });
  if (!batch) throw new HttpError(404, "not_found", "Import not found.");

  const rows = JSON.parse(batch.rowsJson) as ImportRow[];
  const created = await prisma.$transaction(
    async (tx) => {
      const claim = await tx.importBatch.updateMany({
        where: { id, tenantId, status: "preview" },
        data: { status: "committed" },
      });
      if (claim.count !== 1)
        throw new HttpError(409, "already_done", "This import was already saved or undone.");
      for (const r of rows) {
        const g = await tx.guardian.create({ data: { tenantId, ...r.guardian } });
        await tx.student.create({
          data: {
            tenantId,
            admissionNo: await nextAdmissionNo(tx, tenantId),
            name: r.name,
            dob: new Date(r.dob),
            gender: r.gender,
            category: r.category,
            address: r.address,
            sectionId: r.sectionId,
            guardianId: g.id,
            importBatchId: id,
          },
        });
      }
      await tx.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "import.commit",
          entity: "importBatch",
          entityId: id,
        },
      });
      return rows.length;
    },
    { timeout: 60_000 },
  );
  return NextResponse.json({
    ok: true,
    mode: "api",
    created,
    message: `${created} students added.`,
  });
});
