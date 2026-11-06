import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

/**
 * POST: removes the students a committed import created, as long as none of them has been used yet
 * (attendance, marks, fees, homework, library, transport or certificates). If any has, nothing is
 * removed and the response says how many are in use.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "admission_officer",
  ]);
  const { id } = await ctx.params;
  const batch = await prisma.importBatch.findFirst({ where: { id, tenantId } });
  if (!batch) throw new HttpError(404, "not_found", "Import not found.");
  if (batch.status !== "committed")
    throw new HttpError(409, "not_committed", "Only a saved import can be undone.");

  const students = await prisma.student.findMany({
    where: { tenantId, importBatchId: id },
    include: {
      _count: {
        select: {
          attendance: true,
          marks: true,
          invoices: true,
          homeworkRows: true,
          loans: true,
          certificates: true,
        },
      },
      transport: { select: { id: true } },
    },
  });
  const used = students.filter(
    (s) => s.transport || Object.values(s._count).some((n) => n > 0) || s.userId,
  );
  if (used.length)
    throw new HttpError(
      409,
      "in_use",
      `${used.length} of these students already have records (attendance, fees, marks or a login). Nothing was removed.`,
    );

  const guardianIds = [
    ...new Set(students.map((s) => s.guardianId).filter((g): g is string => !!g)),
  ];
  await prisma.$transaction(async (tx) => {
    const claim = await tx.importBatch.updateMany({
      where: { id, tenantId, status: "committed" },
      data: { status: "undone" },
    });
    if (claim.count !== 1) throw new HttpError(409, "not_committed", "Already undone.");
    await tx.student.deleteMany({ where: { tenantId, importBatchId: id } });
    // Guardians created for the import are removed only if no other student shares them.
    await tx.guardian.deleteMany({
      where: { tenantId, id: { in: guardianIds }, students: { none: {} }, userId: null },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "import.undo",
        entity: "importBatch",
        entityId: id,
      },
    });
  });
  return NextResponse.json({ ok: true, mode: "api", removed: students.length });
});
