import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ published: z.boolean() });

/**
 * Publishing makes the results visible to parents and students; unpublishing hides them again.
 * Publishing is refused while any class still has draft or missing mark sheets for this exam,
 * so a half-finished result is never released.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const { published } = Body.parse(await req.json());
  const exam = await prisma.exam.findFirst({ where: { id, tenantId } });
  if (!exam) throw new HttpError(404, "not_found", "Exam not found.");

  if (published) {
    const sections = await prisma.section.findMany({
      where: { tenantId, students: { some: { status: "active" } } },
      select: { id: true, name: true, class: { select: { id: true, name: true } } },
    });
    const subjects = await prisma.subject.findMany({ where: { tenantId } });
    const sheets = await prisma.markSheet.findMany({
      where: { tenantId, examId: id, status: "submitted" },
    });
    const done = new Set(sheets.map((s) => `${s.sectionId}|${s.subjectId}`));
    const missing: string[] = [];
    for (const sec of sections)
      for (const sub of subjects.filter((s) => s.classId === sec.class.id))
        if (!done.has(`${sec.id}|${sub.id}`))
          missing.push(`${sec.class.name} ${sec.name}: ${sub.name}`);
    if (missing.length)
      throw new HttpError(
        409,
        "incomplete",
        `Marks are not submitted for ${missing.length} subject sheet(s), e.g. ${missing.slice(0, 3).join("; ")}.`,
      );
  }
  await prisma.$transaction([
    prisma.exam.update({
      where: { id },
      data: { published, publishedAt: published ? new Date() : null },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: published ? "exam.publish" : "exam.unpublish",
        entity: "exam",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: published ? "Results published." : "Results hidden.",
  });
});
