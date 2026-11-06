import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import {
  dayField,
  dayStr,
  homeworkInclude,
  homeworkView,
  toDay,
  todayIST,
} from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };
const STAFF = ["school_owner", "principal", "teacher"] as const;
const notFound = () => new HttpError(404, "not_found", "Homework not found.");

/** Principal/owner can touch any homework; a teacher only their own. */
const isManager = (role: string) => role === "school_owner" || role === "principal";

/**
 * Detail. Staff get the class roster with each student's status and totals; a parent gets only
 * their own children, and only for published homework of a class those children are in.
 */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant([...STAFF, "parent"]);
  const { id } = await ctx.params;
  const h = await prisma.homework.findFirst({
    where: { id, tenantId },
    include: { ...homeworkInclude, rows: true },
  });
  if (!h) throw notFound();

  const students = await prisma.student.findMany({
    where: {
      tenantId,
      sectionId: h.sectionId,
      status: "active",
      ...(user.role === "parent" ? { guardian: { userId: user.id } } : {}),
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  if (user.role === "parent") {
    if (h.status !== "published" || students.length === 0) throw notFound();
  } else if (h.status === "draft" && !isManager(user.role) && h.createdById !== user.id) {
    throw notFound();
  }
  const status = new Map(h.rows.map((r) => [r.studentId, r]));
  const roster = students.map((s, i) => ({
    studentId: s.id,
    name: s.name,
    rollNo: i + 1,
    status: status.get(s.id)?.status ?? "pending",
    note: status.get(s.id)?.note ?? null,
  }));
  const count = (k: string) => roster.filter((r) => r.status === k).length;
  return NextResponse.json({
    ...homeworkView(h),
    roster,
    totals: {
      done: count("done"),
      missing: count("missing"),
      excused: count("excused"),
      pending: count("pending"),
    },
  });
});

const Patch = z
  .object({
    title: z.string().trim().min(3).max(120),
    description: z.string().trim().min(1).max(3000),
    dueOn: dayField,
    status: z.enum(["published", "withdrawn"]),
  })
  .partial()
  .strict();

/**
 * Edit homework. A draft can be edited and published; a published one can be edited (e.g. a
 * later due date) and withdrawn; a withdrawn one is final. A due date can never be moved into the past.
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...STAFF]);
  const { id } = await ctx.params;
  const cur = await prisma.homework.findFirst({ where: { id, tenantId } });
  if (!cur || (!isManager(user.role) && cur.createdById !== user.id)) throw notFound();
  const b = Patch.parse(await req.json());
  if (cur.status === "withdrawn")
    throw new HttpError(409, "withdrawn", "Withdrawn homework cannot be changed.");
  if (b.status === "withdrawn" && cur.status === "draft")
    throw new HttpError(409, "bad_transition", "A draft is not published yet; edit it instead.");
  if (b.status === "published" && cur.status === "published")
    throw new HttpError(409, "bad_transition", "Already published.");

  const today = todayIST();
  if (b.dueOn && b.dueOn !== dayStr(cur.dueOn) && b.dueOn < today)
    throw new HttpError(422, "past_due", "The due date cannot be in the past.");
  const publishing = b.status === "published";
  const assignedOn = publishing ? today : dayStr(cur.assignedOn);
  const dueOn = b.dueOn ?? dayStr(cur.dueOn);
  if (publishing && dueOn < today)
    throw new HttpError(422, "past_due", "Move the due date forward before publishing.");
  if (dueOn < assignedOn)
    throw new HttpError(422, "past_due", "The due date cannot be before the assigned date.");

  const h = await prisma.homework.update({
    where: { id },
    data: {
      title: b.title,
      description: b.description,
      status: b.status,
      dueOn: toDay(dueOn),
      ...(publishing ? { assignedOn: toDay(assignedOn) } : {}),
    },
    include: homeworkInclude,
  });
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "homework.update",
      entity: "homework",
      entityId: id,
    },
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Homework updated.",
    homework: homeworkView(h),
  });
});
