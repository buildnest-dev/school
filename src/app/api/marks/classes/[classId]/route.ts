import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { roster, sectionLabel, sectionOr404 } from "@/server/lib";

type Ctx = { params: Promise<{ classId: string }> };
const WRITE = ["principal", "teacher"] as const;

/** Resolves ?examId=&subjectId= (defaults: first exam of the school, first subject of the class). */
async function target(tenantId: string, classId: string, url: string) {
  const section = await sectionOr404(tenantId, classId);
  const sp = new URL(url).searchParams;
  const examId = sp.get("examId");
  const subjectId = sp.get("subjectId");
  const exam = await prisma.exam.findFirst({
    where: { tenantId, ...(examId ? { id: examId } : {}) },
    orderBy: { name: "asc" },
  });
  const subject = await prisma.subject.findFirst({
    where: { tenantId, classId: section.classId, ...(subjectId ? { id: subjectId } : {}) },
    orderBy: { name: "asc" },
  });
  if (!exam || !subject)
    throw new HttpError(404, "not_found", "No exam or subject is set up for this class.");
  return { section, exam, subject };
}

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const { tenantId } = await requireTenant([...WRITE, "school_owner"]);
  const { classId } = await ctx.params;
  const { section, exam, subject } = await target(tenantId, classId, req.url);
  const [students, rows, sheet] = await Promise.all([
    roster(tenantId, classId),
    prisma.mark.findMany({ where: { tenantId, examId: exam.id, subjectId: subject.id } }),
    prisma.markSheet.findUnique({
      where: {
        examId_sectionId_subjectId: { examId: exam.id, sectionId: classId, subjectId: subject.id },
      },
    }),
  ]);
  const saved = new Map(rows.map((m) => [m.studentId, m.score]));
  return NextResponse.json({
    classId,
    classLabel: sectionLabel(section),
    subject: subject.name,
    assessment: exam.name,
    maxMarks: exam.maxMarks,
    status: sheet?.status === "submitted" ? "submitted" : "draft",
    roster: students,
    marks: Object.fromEntries(students.map((s) => [s.id, saved.get(s.id) ?? null])),
  });
});

const Body = z.object({
  marks: z.record(z.string(), z.number().nullable()),
  submit: z.boolean(),
});

export const PUT = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...WRITE]);
  const { classId } = await ctx.params;
  const { exam, subject } = await target(tenantId, classId, req.url);
  const body = Body.parse(await req.json());

  const valid = new Set((await roster(tenantId, classId)).map((s) => s.id));
  for (const [id, score] of Object.entries(body.marks)) {
    if (!valid.has(id))
      throw new HttpError(422, "unknown_student", "A student is not in this class.");
    if (score !== null && (score < 0 || score > exam.maxMarks))
      throw new HttpError(422, "out_of_range", `Marks must be between 0 and ${exam.maxMarks}.`);
  }
  if (body.submit && Object.values(body.marks).some((v) => v === null))
    throw new HttpError(
      422,
      "incomplete",
      "Enter marks (or 0) for every student before submitting.",
    );

  const where = {
    examId_sectionId_subjectId: { examId: exam.id, sectionId: classId, subjectId: subject.id },
  };
  const sheet = await prisma.markSheet.findUnique({ where });
  if (sheet?.status === "submitted" && user.role === "teacher")
    throw new HttpError(
      409,
      "locked",
      "These marks are submitted. Ask the principal to reopen them.",
    );

  await prisma.$transaction([
    ...Object.entries(body.marks).map(([studentId, score]) =>
      prisma.mark.upsert({
        where: {
          examId_subjectId_studentId: { examId: exam.id, subjectId: subject.id, studentId },
        },
        update: { score },
        create: { tenantId, examId: exam.id, subjectId: subject.id, studentId, score },
      }),
    ),
    prisma.markSheet.upsert({
      where,
      update: body.submit ? { status: "submitted" } : {},
      create: {
        tenantId,
        examId: exam.id,
        sectionId: classId,
        subjectId: subject.id,
        status: body.submit ? "submitted" : "draft",
      },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: body.submit ? "marks.submit" : "marks.save",
        entity: "markSheet",
        entityId: classId,
      },
    }),
  ]);
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: body.submit ? "Marks submitted." : "Draft saved.",
  });
});
