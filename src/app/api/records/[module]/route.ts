import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { notifyUsers } from "@/server/push";
import {
  assertNoOverlap,
  readable,
  readFields,
  registerFor,
  studentChoices,
  viewRows,
} from "@/server/registers";

type Ctx = { params: Promise<{ module: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant();
  const { def, rights } = registerFor((await ctx.params).module, user);
  const rows = await prisma.schoolRecord.findMany({
    where: await readable(tenantId, user, def, rights),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 500,
  });
  const canAdd = rights.manage || rights.submit;
  const [items, students, staff] = await Promise.all([
    viewRows(tenantId, user, def, rights, rows),
    def.student && canAdd ? studentChoices(tenantId, user, rights) : [],
    def.staff && rights.manage
      ? prisma.staff.findMany({
          where: { tenantId, status: "active" },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ]);
  return NextResponse.json({ items, students, staff });
});

const Body = z.object({
  title: z.string().trim().min(2).max(200),
  studentId: z.string().max(60).optional(),
  staffId: z.string().max(60).optional(),
  status: z.string().max(30).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const POST = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant();
  const { def, rights } = registerFor((await ctx.params).module, user);
  if (!rights.manage && !rights.submit)
    throw new HttpError(403, "forbidden", "You can read this register but not add to it.");
  if (!rights.manage) await throttle(`record|${user.id}`, 30, 10 * 60_000);
  const b = Body.parse(await req.json());
  const data = readFields(def, b.data, rights.manage, false);
  const status = rights.manage && b.status ? b.status : def.statuses[0]!;
  if (!def.statuses.includes(status)) throw new HttpError(422, "bad_status", "Unknown stage.");

  const studentId = def.student && b.studentId ? b.studentId : null;
  if (def.student === "required" && !studentId)
    throw new HttpError(422, "student_needed", "Choose a student.");
  if (studentId) {
    const choices = await studentChoices(tenantId, user, rights);
    if (!choices.some((s) => s.id === studentId))
      throw new HttpError(404, "not_found", "Student not found.");
  }
  const staffId = def.staff && rights.manage && b.staffId ? b.staffId : null;
  if (def.staff === "required" && rights.manage && !staffId)
    throw new HttpError(422, "staff_needed", "Choose a staff member.");
  if (staffId && !(await prisma.staff.findFirst({ where: { id: staffId, tenantId } })))
    throw new HttpError(404, "not_found", "Staff member not found.");

  const row = await prisma.$transaction(async (tx) => {
    await assertNoOverlap(tx, tenantId, def, data, status);
    const created = await tx.schoolRecord.create({
      data: {
        tenantId,
        module: def.key,
        title: b.title,
        status,
        data: JSON.stringify(data),
        studentId,
        staffId,
        onDate: data.date ? new Date(data.date) : null,
        createdById: user.id,
        createdByName: user.name,
      },
    });
    await tx.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "record.create",
        entity: def.key,
        entityId: created.id,
      },
    });
    return created;
  });

  // Tell the parent when the school writes something about their child that they can read.
  if (studentId && def.family && rights.manage) {
    const s = await prisma.student.findFirst({
      where: { id: studentId, tenantId },
      select: { guardian: { select: { userId: true } } },
    });
    if (s?.guardian?.userId)
      await notifyUsers(tenantId, [s.guardian.userId], {
        title: def.title,
        body: b.title.slice(0, 140),
        url: `/parent/records/${def.key}`,
      });
  }
  return NextResponse.json({ ok: true, id: row.id, message: "Saved." }, { status: 201 });
});
