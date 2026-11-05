import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { sectionOr404 } from "@/server/lib";
import { checkLocation, studentDetail, studentInclude } from "@/server/students";
import { guardianInput, studentFields } from "@/server/validators";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant([
    "school_owner",
    "principal",
    "teacher",
    "accountant",
    "parent",
  ]);
  const { id } = await ctx.params;
  const s = await prisma.student.findFirst({ where: { id, tenantId }, include: studentInclude });
  if (!s) throw new HttpError(404, "not_found", "Student not found.");
  // A parent may only open their own child: the guardian record must be linked to this login.
  if (user.role === "parent") {
    const g = s.guardianId
      ? await prisma.guardian.findFirst({ where: { id: s.guardianId, userId: user.id } })
      : null;
    if (!g) throw new HttpError(404, "not_found", "Student not found.");
  }
  return NextResponse.json(studentDetail(s));
});

const PatchBody = studentFields
  .partial()
  .extend({
    guardian: guardianInput.partial().optional(),
    status: z.enum(["active", "alumni", "transferred"]).optional(),
  })
  .strict();

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const b = PatchBody.parse(await req.json());
  const current = await prisma.student.findFirst({ where: { id, tenantId } });
  if (!current) throw new HttpError(404, "not_found", "Student not found.");
  if (b.sectionId) await sectionOr404(tenantId, b.sectionId);
  await checkLocation(b.stateId ?? current.stateId ?? undefined, b.districtId);

  const { guardian, dob, ...rest } = b;
  const updated = await prisma.$transaction(async (tx) => {
    if (guardian && current.guardianId)
      await tx.guardian.updateMany({
        where: { id: current.guardianId, tenantId },
        data: guardian,
      });
    const s = await tx.student.update({
      where: { id },
      data: { ...rest, ...(dob ? { dob: new Date(dob) } : {}) },
      include: studentInclude,
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: b.status && b.status !== current.status ? `student.${b.status}` : "student.update",
        entity: "student",
        entityId: id,
      },
    });
    return s;
  });
  return NextResponse.json({ ok: true, mode: "api", id, student: studentDetail(updated) });
});
