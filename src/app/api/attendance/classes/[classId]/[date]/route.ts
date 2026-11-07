import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { parseDay, roster, sectionLabel, sectionOr404 } from "@/server/lib";
import { notifyUsers } from "@/server/push";
import { assertTeachesSection } from "@/server/teaching";

type Ctx = { params: Promise<{ classId: string; date: string }> };
const READ = ["school_owner", "principal", "teacher"] as const;
const WRITE = ["principal", "teacher"] as const;

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant([...READ]);
  const { classId, date } = await ctx.params;
  const day = parseDay(date);
  const section = await sectionOr404(tenantId, classId);
  await assertTeachesSection(tenantId, user, classId);
  const [students, rows, sheet] = await Promise.all([
    roster(tenantId, classId),
    prisma.attendance.findMany({ where: { tenantId, sectionId: classId, date: day } }),
    prisma.attendanceSheet.findUnique({
      where: { sectionId_date: { sectionId: classId, date: day } },
    }),
  ]);
  const saved = new Map(rows.map((r) => [r.studentId, r.status]));
  // Everyone starts as present, so the teacher only has to tap the exceptions.
  const marks = Object.fromEntries(students.map((s) => [s.id, saved.get(s.id) ?? "present"]));
  return NextResponse.json({
    classId,
    classLabel: sectionLabel(section),
    date,
    status: sheet?.status === "submitted" ? "submitted" : "draft",
    roster: students,
    marks,
  });
});

const Body = z.object({
  marks: z.record(z.string(), z.enum(["present", "absent", "late"])),
  submit: z.boolean(),
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...WRITE]);
  const { classId, date } = await ctx.params;
  const day = parseDay(date);
  if (day.getTime() > Date.now() + 24 * 3600_000)
    throw new HttpError(400, "future_date", "Attendance cannot be recorded for a future date.");
  await sectionOr404(tenantId, classId);
  await assertTeachesSection(tenantId, user, classId);
  const body = Body.parse(await req.json());

  const valid = new Set((await roster(tenantId, classId)).map((s) => s.id));
  const ids = Object.keys(body.marks);
  if (ids.some((id) => !valid.has(id)))
    throw new HttpError(422, "unknown_student", "A student in the request is not in this class.");

  const existing = await prisma.attendanceSheet.findUnique({
    where: { sectionId_date: { sectionId: classId, date: day } },
  });
  if (existing?.status === "submitted" && user.role === "teacher")
    throw new HttpError(
      409,
      "locked",
      "This attendance is submitted. Ask the principal to reopen it.",
    );

  await prisma.$transaction([
    ...ids.map((studentId) =>
      prisma.attendance.upsert({
        where: { studentId_date: { studentId, date: day } },
        update: { status: body.marks[studentId]! },
        create: {
          tenantId,
          sectionId: classId,
          studentId,
          date: day,
          status: body.marks[studentId]!,
        },
      }),
    ),
    prisma.attendanceSheet.upsert({
      where: { sectionId_date: { sectionId: classId, date: day } },
      update: body.submit
        ? { status: "submitted", submittedBy: user.id, submittedAt: new Date() }
        : {},
      create: {
        tenantId,
        sectionId: classId,
        date: day,
        status: body.submit ? "submitted" : "draft",
        submittedBy: body.submit ? user.id : null,
        submittedAt: body.submit ? new Date() : null,
      },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: body.submit ? "attendance.submit" : "attendance.save",
        entity: "section",
        entityId: classId,
      },
    }),
  ]);
  // Parents hear about an absence once, when the sheet is first submitted (not on drafts or edits).
  if (body.submit && existing?.status !== "submitted") {
    const absent = ids.filter((id) => body.marks[id] === "absent");
    if (absent.length) {
      const kids = await prisma.student.findMany({
        where: { id: { in: absent }, tenantId, guardian: { userId: { not: null } } },
        select: { name: true, guardian: { select: { userId: true } } },
      });
      const label = sectionLabel(await sectionOr404(tenantId, classId));
      await Promise.all(
        kids.map((k) =>
          notifyUsers(tenantId, [k.guardian!.userId!], {
            title: `${k.name} was absent today`,
            body: `${k.name} (${label}) was marked absent on ${date}. Please contact the school if this is a mistake.`,
            url: "/parent/attendance",
          }),
        ),
      );
    }
  }
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: body.submit ? "Attendance has been recorded." : "Draft saved.",
  });
});
