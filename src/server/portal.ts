import type { SessionUser } from "@/types";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { todayIST } from "./homework";

/** Monday = 1 … Sunday = 7, for a YYYY-MM-DD day. */
export const weekdayOf = (day: string) => {
  const d = new Date(`${day}T00:00:00.000Z`).getUTCDay();
  return d === 0 ? 7 : d;
};

/** The staff record behind a teacher's login, if they have one. */
export const staffOf = (tenantId: string, userId: string) =>
  prisma.staff.findFirst({ where: { tenantId, userId, status: "active" } });

/**
 * A student the signed-in person may look at: a parent sees only their own linked children, a
 * student sees only themselves. Anything else is a 404, never a hint that the child exists.
 */
export async function childFor(tenantId: string, user: SessionUser, childId: string) {
  const student = await prisma.student.findFirst({
    where: {
      id: childId,
      tenantId,
      status: "active",
      ...(user.role === "parent" ? { guardian: { userId: user.id } } : { userId: user.id }),
    },
    include: { section: { include: { class: true } } },
  });
  if (!student) throw new HttpError(404, "not_found", "Child not found.");
  return student;
}

/** Today's timetable for a section, or for one teacher, with the bell times attached. */
export async function daySlots(
  tenantId: string,
  where: { sectionId?: string; staffId?: string },
  day = todayIST(),
) {
  const [periods, bells] = await Promise.all([
    prisma.period.findMany({
      where: { tenantId, ...where, day: weekdayOf(day) },
      include: {
        subject: { select: { name: true } },
        staff: { select: { name: true } },
        section: { include: { class: true } },
      },
      orderBy: { slot: "asc" },
    }),
    prisma.bellSlot.findMany({ where: { tenantId } }),
  ]);
  const bell = new Map(bells.map((b) => [b.slot, b]));
  return periods.map((p) => {
    const b = bell.get(p.slot);
    return {
      slot: p.slot,
      sectionId: p.sectionId,
      period: b?.label ?? `Period ${p.slot}`,
      time: b ? `${b.startsAt}–${b.endsAt}` : "",
      subject: p.subject.name,
      subjectId: p.subjectId,
      classLabel: `${p.section.class.name} ${p.section.name}`,
      room: p.room ?? "",
      teacher: p.staff?.name ?? "",
    };
  });
}

/** One student's fee ledger, oldest first with a running balance (money in rupees). */
export async function studentLedger(tenantId: string, studentId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { tenantId, studentId },
    include: { payments: true },
  });
  const events: { id: string; at: Date; description: string; debit: number; credit: number }[] = [];
  for (const i of invoices) {
    events.push({
      id: i.id,
      at: i.createdAt,
      description: `${i.number} · ${i.title}`,
      debit: i.amountPaise / 100,
      credit: 0,
    });
    for (const p of i.payments) {
      const refund = p.amountPaise < 0;
      events.push({
        id: p.id,
        at: p.paidOn,
        description: refund ? `Refund · ${i.number}` : `Payment (${p.mode}) · ${i.number}`,
        debit: refund ? -p.amountPaise / 100 : 0,
        credit: refund ? 0 : p.amountPaise / 100,
      });
    }
  }
  events.sort((a, b) => a.at.getTime() - b.at.getTime());
  let balance = 0;
  return events.map((e) => {
    balance = Math.round((balance + e.debit - e.credit) * 100) / 100;
    return {
      id: e.id,
      date: e.at.toISOString().slice(0, 10),
      description: e.description,
      debit: e.debit,
      credit: e.credit,
      balance,
    };
  });
}
