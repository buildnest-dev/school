import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { sectionOr404 } from "@/server/lib";
import { activeTeacherOr422 } from "@/server/staff";

const Body = z.object({ staffId: z.string().min(1).nullable() });

/** Sets (or clears, with null) the class teacher of a section. Must be an active teacher of this school. */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ sectionId: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const section = await sectionOr404(tenantId, (await ctx.params).sectionId);
  const { staffId } = Body.parse(await req.json());
  if (staffId) await activeTeacherOr422(tenantId, staffId);
  await prisma.$transaction([
    prisma.section.update({ where: { id: section.id }, data: { classTeacherId: staffId } }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "section.classTeacher",
        entity: "section",
        entityId: section.id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "Class teacher saved." });
});
