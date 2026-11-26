import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { parseDay } from "@/server/lib";
import { staffOf } from "@/server/portal";
import { notifyUsers } from "@/server/push";
import { coverDay } from "@/server/substitutions";

const MANAGE = ["school_owner", "principal", "vice_principal"] as const;

/** Managers: the day's uncovered lessons. Teachers: the lessons they were asked to cover. */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...MANAGE, "teacher"]);
  const date = new URL(req.url).searchParams.get("date") || todayIST();
  const d = await coverDay(tenantId, date);
  if (user.role === "teacher") {
    const me = await staffOf(tenantId, user.id);
    const mine = d.covers
      .filter((c) => c.coverStaffId === me?.id)
      .map((c) => {
        const p = d.periods.find((x) => x.sectionId === c.sectionId && x.slot === c.slot);
        return {
          id: c.id,
          slot: c.slot,
          period: d.periodName(c.slot),
          classLabel: p ? `${p.section.class.name} ${p.section.name}` : "",
          subject: p?.subject.name ?? "",
          room: p?.room ?? "",
        };
      });
    return NextResponse.json({ date, mine });
  }
  return NextResponse.json({ date, away: d.away, needs: d.needs });
});

const Body = z.object({
  date: z.string(),
  sectionId: z.string().min(1),
  slot: z.number().int().min(1).max(12),
  coverStaffId: z.string().min(1),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...MANAGE]);
  const b = Body.parse(await req.json());
  const d = await coverDay(tenantId, b.date);
  const need = d.needs.find((n) => n.sectionId === b.sectionId && n.slot === b.slot);
  if (!need) throw new HttpError(422, "not_needed", "That lesson does not need cover on this day.");
  if (need.coverId) throw new HttpError(409, "covered", "That lesson already has cover.");
  if (!need.free.some((t) => t.id === b.coverStaffId))
    throw new HttpError(409, "teacher_busy", "That teacher is not free in this period.");
  await prisma.$transaction([
    prisma.substitution.create({
      data: {
        tenantId,
        date: parseDay(b.date),
        sectionId: b.sectionId,
        slot: b.slot,
        absentStaffId: need.absentStaffId,
        coverStaffId: b.coverStaffId,
        createdBy: user.name,
      },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "substitution.create",
        entity: "section",
        entityId: b.sectionId,
      },
    }),
  ]);
  const cover = await prisma.staff.findFirst({ where: { id: b.coverStaffId, tenantId } });
  if (cover?.userId)
    await notifyUsers(tenantId, [cover.userId], {
      title: "Cover lesson",
      body: `${need.classLabel}, ${need.period} on ${b.date}`,
      url: "/teacher/covers",
    });
  return NextResponse.json({ ok: true, message: "Cover arranged." }, { status: 201 });
});
