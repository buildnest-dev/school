import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { assertStaffContactFree, staffFields, staffView } from "@/server/staff";

const MANAGE = ["school_owner", "principal"] as const;

async function load(tenantId: string, id: string) {
  const s = await prisma.staff.findFirst({ where: { id, tenantId } });
  if (!s) throw new HttpError(404, "not_found", "Staff member not found.");
  return s;
}

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { tenantId } = await requireTenant([...MANAGE]);
  const s = await load(tenantId, (await ctx.params).id);
  const [periods, classTeacherOf] = await Promise.all([
    prisma.period.count({ where: { tenantId, staffId: s.id } }),
    prisma.section.findMany({
      where: { tenantId, classTeacherId: s.id },
      include: { class: true },
    }),
  ]);
  return NextResponse.json({
    ...staffView(s),
    periodsPerWeek: periods,
    classTeacherOf: classTeacherOf.map((x) => ({
      sectionId: x.id,
      label: `${x.class.name} ${x.name}`,
    })),
  });
});

const Patch = staffFields
  .partial()
  .extend({ status: z.enum(["active", "inactive"]).optional() })
  .strict();

/**
 * Edit a staff member. Making someone inactive takes them off the timetable and ends any
 * class-teacher assignment, so nobody inactive stays scheduled. Changing the role away from
 * teacher is refused while they still teach periods.
 */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...MANAGE]);
  const cur = await load(tenantId, (await ctx.params).id);
  const b = Patch.parse(await req.json());
  await assertStaffContactFree(tenantId, { phone: b.phone, email: b.email }, cur.id);

  const deactivating = b.status === "inactive" && cur.status === "active";
  if (b.role && b.role !== "teacher" && cur.role === "teacher") {
    const n = await prisma.period.count({ where: { tenantId, staffId: cur.id } });
    if (n > 0 && !deactivating)
      throw new HttpError(
        409,
        "has_periods",
        "Remove this teacher from the timetable before changing their role.",
      );
  }

  const { joinedOn, ...rest } = b;
  const [updated, freed] = await prisma.$transaction([
    prisma.staff.update({
      where: { id: cur.id },
      data: { ...rest, ...(joinedOn ? { joinedOn: new Date(`${joinedOn}T00:00:00.000Z`) } : {}) },
    }),
    prisma.period.updateMany({
      where: { tenantId, staffId: cur.id, ...(deactivating ? {} : { id: "__none__" }) },
      data: { staffId: null },
    }),
    prisma.section.updateMany({
      where: { tenantId, classTeacherId: cur.id, ...(deactivating ? {} : { id: "__none__" }) },
      data: { classTeacherId: null },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "staff.update",
        entity: "staff",
        entityId: cur.id,
      },
    }),
  ]);
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Staff member updated.",
    unassignedPeriods: freed.count,
    staff: staffView(updated),
  });
});
