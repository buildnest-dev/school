import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { studentsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { notifyUsers } from "@/server/push";

/** The students a teacher may write about, and what they have sent so far. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const [students, sent] = await Promise.all([
    studentsFor(tenantId, user),
    prisma.teacherMessage.findMany({
      where: { tenantId, senderUserId: user.id },
      orderBy: { sentAt: "desc" },
      take: 100,
    }),
  ]);
  const name = new Map(students.map((s) => [s.id, `${s.name} · ${s.classLabel}`]));
  return NextResponse.json({
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      classLabel: s.classLabel,
      parentHasLogin: s.guardianUserId !== null,
    })),
    sent: sent.map((m) => ({
      id: m.id,
      about: name.get(m.studentId) ?? "Student",
      body: m.body,
      sentAt: m.sentAt.toISOString(),
      reply: m.reply,
    })),
  });
});

const Body = z.object({
  studentId: z.string().min(1),
  body: z.string().trim().min(2).max(1000),
});

/** Sends a note to the parent of a student the teacher teaches. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["teacher"]);
  const b = Body.parse(await req.json());
  const student = (await studentsFor(tenantId, user)).find((s) => s.id === b.studentId);
  if (!student) throw new HttpError(404, "not_found", "Student not found in your classes.");
  await prisma.teacherMessage.create({
    data: { tenantId, ...b, senderUserId: user.id, senderName: user.name },
  });
  if (student.guardianUserId)
    await notifyUsers(tenantId, [student.guardianUserId], {
      title: `Message from ${user.name}`,
      body: b.body.slice(0, 140),
      url: "/parent/messages",
    });
  return NextResponse.json(
    {
      ok: true,
      mode: "api",
      message: student.guardianUserId
        ? "Sent to the parent."
        : "Saved. The parent has no login yet, so they will see it once they get one.",
    },
    { status: 201 },
  );
});
