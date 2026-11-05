import { prisma } from "./db";

export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

type PeriodRow = {
  id: string;
  day: number;
  slot: number;
  room: string | null;
  sectionId: string;
  subject: { id: string; name: string };
  staff: { id: string; name: string } | null;
  section: { name: string; class: { name: string } };
};

export const periodView = (p: PeriodRow) => ({
  id: p.id,
  day: p.day,
  dayName: DAY_NAMES[p.day - 1],
  slot: p.slot,
  subjectId: p.subject.id,
  subject: p.subject.name,
  staffId: p.staff?.id ?? null,
  teacher: p.staff?.name ?? null,
  room: p.room,
  sectionId: p.sectionId,
  classSection: `${p.section.class.name} ${p.section.name}`,
});

export const periodInclude = {
  subject: { select: { id: true, name: true } },
  staff: { select: { id: true, name: true } },
  section: { select: { name: true, class: { select: { name: true } } } },
} as const;

export const bellSchedule = async (tenantId: string) =>
  (await prisma.bellSlot.findMany({ where: { tenantId }, orderBy: { slot: "asc" } })).map((s) => ({
    slot: s.slot,
    label: s.label,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    isBreak: s.isBreak,
  }));
