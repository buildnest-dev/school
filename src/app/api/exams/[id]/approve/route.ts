import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ approved: z.boolean() });

/**
 * Approval is the second pair of eyes before results are released: all mark sheets must be
 * submitted first. Changing any marks afterwards clears the approval, so what was approved is
 * always what gets published.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "vice_principal"]);
  const { id } = await ctx.params;
  const { approved } = Body.parse(await req.json());
  const exam = await prisma.exam.findFirst({ where: { id, tenantId } });
  if (!exam) throw new HttpError(404, "not_found", "Exam not found.");
  if (exam.published && !approved)
    throw new HttpError(409, "published", "Hide the results before withdrawing the approval.");

  if (approved) {
    const draft = await prisma.markSheet.count({
      where: { tenantId, examId: id, status: "draft" },
    });
    const submitted = await prisma.markSheet.count({
      where: { tenantId, examId: id, status: "submitted" },
    });
    if (draft > 0 || submitted === 0)
      throw new HttpError(
        409,
        "incomplete",
        draft > 0
          ? `${draft} mark sheet(s) are still drafts. Submit them before approving.`
          : "No marks have been submitted for this exam yet.",
      );
  }
  await prisma.$transaction([
    prisma.exam.update({
      where: { id },
      data: approved
        ? { approvedAt: new Date(), approvedById: user.id }
        : { approvedAt: null, approvedById: null },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: approved ? "exam.approve" : "exam.unapprove",
        entity: "exam",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: approved ? "Marks approved. They can now be published." : "Approval withdrawn.",
  });
});
