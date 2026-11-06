import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  assertCanAssign,
  dayField,
  homeworkInclude,
  homeworkView,
  toDay,
  todayIST,
} from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { sectionOr404 } from "@/server/lib";

const STAFF = ["school_owner", "principal", "teacher"] as const;

/**
 * Staff: homework of the school (?sectionId= to narrow); drafts are visible only to their author
 * and the principal/owner. Parent: published homework of their own children's classes, each with
 * that child's completion status (?studentId= to narrow to one child).
 */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...STAFF, "parent"]);
  const q = new URL(req.url).searchParams;
  const sectionId = q.get("sectionId") ?? undefined;

  if (user.role === "parent") {
    const studentId = q.get("studentId") ?? undefined;
    const kids = await prisma.student.findMany({
      where: {
        tenantId,
        status: "active",
        guardian: { userId: user.id },
        sectionId: sectionId ?? { not: null },
        ...(studentId ? { id: studentId } : {}),
      },
      select: { id: true, name: true, sectionId: true },
    });
    const rows = await prisma.homework.findMany({
      where: {
        tenantId,
        status: "published",
        sectionId: { in: kids.map((k) => k.sectionId!) },
      },
      include: {
        ...homeworkInclude,
        rows: { where: { studentId: { in: kids.map((k) => k.id) } } },
      },
      orderBy: [{ dueOn: "desc" }, { createdAt: "desc" }],
    });
    const items = rows.map((h) => ({
      ...homeworkView(h),
      children: kids
        .filter((k) => k.sectionId === h.sectionId)
        .map((k) => ({
          studentId: k.id,
          name: k.name,
          status: h.rows.find((r) => r.studentId === k.id)?.status ?? "pending",
        })),
    }));
    return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
  }

  const rows = await prisma.homework.findMany({
    where: {
      tenantId,
      ...(sectionId ? { sectionId } : {}),
      OR:
        user.role === "teacher"
          ? [{ status: { not: "draft" } }, { createdById: user.id }]
          : undefined,
    },
    include: homeworkInclude,
    orderBy: [{ dueOn: "desc" }, { createdAt: "desc" }],
  });
  const items = rows.map(homeworkView);
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

const Body = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(1).max(3000),
  dueOn: dayField,
  publish: z.boolean().default(false),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...STAFF]);
  const b = Body.parse(await req.json());
  const section = await sectionOr404(tenantId, b.sectionId);
  const subject = await prisma.subject.findFirst({
    where: { id: b.subjectId, tenantId, classId: section.classId },
  });
  if (!subject)
    throw new HttpError(422, "bad_subject", "This subject is not taught in this class.");
  await assertCanAssign(tenantId, user, section.id, subject.id);
  const today = todayIST();
  if (b.dueOn < today) throw new HttpError(422, "past_due", "The due date cannot be in the past.");
  const h = await prisma.homework.create({
    data: {
      tenantId,
      sectionId: section.id,
      subjectId: subject.id,
      title: b.title,
      description: b.description,
      assignedOn: toDay(today),
      dueOn: toDay(b.dueOn),
      status: b.publish ? "published" : "draft",
      createdById: user.id,
      authorName: user.name,
    },
    include: homeworkInclude,
  });
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "homework.create",
      entity: "homework",
      entityId: h.id,
    },
  });
  return NextResponse.json(
    {
      ok: true,
      mode: "api",
      message: b.publish ? "Homework published." : "Draft saved.",
      homework: homeworkView(h),
    },
    { status: 201 },
  );
});
