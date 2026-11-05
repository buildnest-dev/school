import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { sectionOr404 } from "@/server/lib";
import { nextAdmissionNo } from "@/server/students";

const Body = z.object({ sectionId: z.string().min(1) });

/**
 * Enrols an enquiry that has reached "decision": creates the guardian and student, links them,
 * and marks the enquiry enrolled, all in one transaction. Admitting twice is refused (409).
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const { sectionId } = Body.parse(await req.json());
  await sectionOr404(tenantId, sectionId);

  const student = await prisma.$transaction(async (tx) => {
    // Claim the enquiry first (conditional update) so two concurrent admits cannot both succeed.
    const claimed = await tx.admission.updateMany({
      where: { id, tenantId, stage: "decision", studentId: null },
      data: { stage: "enrolled" },
    });
    if (claimed.count === 0) {
      const a = await tx.admission.findFirst({ where: { id, tenantId } });
      if (!a) throw new HttpError(404, "not_found", "Enquiry not found.");
      if (a.stage === "enrolled")
        throw new HttpError(409, "already_enrolled", "This student is already enrolled.");
      throw new HttpError(409, "not_ready", "Move the enquiry to the decision stage first.");
    }
    const a = await tx.admission.findFirstOrThrow({ where: { id, tenantId } });
    const g = await tx.guardian.create({
      data: {
        tenantId,
        name: a.guardianName,
        relation: "guardian",
        phone: a.guardianPhone,
        email: a.guardianEmail,
      },
    });
    const s = await tx.student.create({
      data: {
        tenantId,
        admissionNo: await nextAdmissionNo(tx, tenantId),
        name: a.studentName,
        dob: a.dob,
        gender: a.gender,
        sectionId,
        guardianId: g.id,
      },
    });
    await tx.admission.update({ where: { id }, data: { studentId: s.id } });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "admission.enrol",
        entity: "student",
        entityId: s.id,
      },
    });
    return s;
  });
  return NextResponse.json(
    {
      ok: true,
      mode: "api",
      id: student.id,
      admissionNo: student.admissionNo,
      message: "Student enrolled.",
    },
    { status: 201 },
  );
});
