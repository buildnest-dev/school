import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM");

/** Bell schedule: visible to everyone signed in to the school (parents see period times too). */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant();
  const slots = await prisma.bellSlot.findMany({ where: { tenantId }, orderBy: { slot: "asc" } });
  return NextResponse.json(
    slots.map((s) => ({
      slot: s.slot,
      label: s.label,
      startsAt: s.startsAt,
      endsAt: s.endsAt,
      isBreak: s.isBreak,
    })),
  );
});

const Body = z.object({
  slots: z
    .array(
      z.object({
        slot: z.number().int().min(1).max(12),
        label: z.string().trim().min(1).max(30),
        startsAt: time,
        endsAt: time,
        isBreak: z.boolean().default(false),
      }),
    )
    .min(1)
    .max(12),
});

/**
 * Replaces the bell schedule. Slots must be in time order with no overlap, and a slot that
 * already holds lessons cannot be removed or turned into a break.
 */
export const PUT = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "vice_principal"]);
  const { slots } = Body.parse(await req.json());
  const sorted = [...slots].sort((a, b) => a.slot - b.slot);
  if (new Set(slots.map((s) => s.slot)).size !== slots.length)
    throw new HttpError(422, "duplicate_slot", "A slot number is used twice.");
  let prev: (typeof sorted)[number] | undefined;
  for (const s of sorted) {
    if (s.startsAt >= s.endsAt)
      throw new HttpError(422, "bad_time", `${s.label}: it must end after it starts.`);
    if (prev && prev.endsAt > s.startsAt)
      throw new HttpError(422, "overlap", `${s.label} overlaps ${prev.label}.`);
    prev = s;
  }
  const lessons = await prisma.period.findMany({
    where: { tenantId },
    distinct: ["slot"],
    select: { slot: true },
  });
  for (const { slot } of lessons) {
    const keep = sorted.find((s) => s.slot === slot);
    if (!keep || keep.isBreak)
      throw new HttpError(
        409,
        "slot_in_use",
        `Slot ${slot} still has lessons in the timetable; clear them first.`,
      );
  }
  await prisma.$transaction([
    prisma.bellSlot.deleteMany({ where: { tenantId } }),
    prisma.bellSlot.createMany({ data: sorted.map((s) => ({ tenantId, ...s })) }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "timetable.bell",
        entity: "tenant",
        entityId: tenantId,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "Bell schedule saved." });
});
