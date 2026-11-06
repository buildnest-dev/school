import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertCanAssign } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        /** "pending" clears a recorded status. */
        status: z.enum(["done", "missing", "excused", "pending"]),
        note: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Records which students handed the homework in. Only published homework, only active students
 * of that class, and only by someone allowed to set homework for that class and subject.
 */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "teacher"]);
  const { id } = await ctx.params;
  const h = await prisma.homework.findFirst({ where: { id, tenantId } });
  if (!h) throw new HttpError(404, "not_found", "Homework not found.");
  await assertCanAssign(tenantId, user, h.sectionId, h.subjectId);
  if (h.status !== "published")
    throw new HttpError(409, "not_published", "Only published homework can be marked.");
  const { entries } = Body.parse(await req.json());
  const ids = [...new Set(entries.map((e) => e.studentId))];
  if (ids.length !== entries.length)
    throw new HttpError(422, "duplicate", "A student is listed twice.");
  const ok = await prisma.student.count({
    where: { tenantId, sectionId: h.sectionId, status: "active", id: { in: ids } },
  });
  if (ok !== ids.length)
    throw new HttpError(422, "bad_student", "Some students are not in this class.");

  await prisma.$transaction([
    prisma.homeworkStatus.deleteMany({
      where: {
        homeworkId: id,
        studentId: { in: entries.filter((e) => e.status === "pending").map((e) => e.studentId) },
      },
    }),
    ...entries
      .filter((e) => e.status !== "pending")
      .map((e) =>
        prisma.homeworkStatus.upsert({
          where: { homeworkId_studentId: { homeworkId: id, studentId: e.studentId } },
          update: { status: e.status, note: e.note ?? null },
          create: {
            tenantId,
            homeworkId: id,
            studentId: e.studentId,
            status: e.status,
            note: e.note ?? null,
          },
        }),
      ),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "homework.completion",
        entity: "homework",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "Saved." });
});
