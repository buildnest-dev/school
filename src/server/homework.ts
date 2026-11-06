import { z } from "zod";

/** Today's date in India (IST, UTC+5:30) as YYYY-MM-DD; school deadlines are IST days. */
export function todayIST(now = Date.now()) {
  return new Date(now + 5.5 * 3600_000).toISOString().slice(0, 10);
}

export const toDay = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const dayStr = (d: Date) => d.toISOString().slice(0, 10);

export { assertCanAssign } from "./teaching";

export const homeworkInclude = {
  subject: { select: { id: true, name: true } },
  section: { select: { id: true, name: true, class: { select: { name: true } } } },
} as const;

type Row = {
  id: string;
  title: string;
  description: string;
  assignedOn: Date;
  dueOn: Date;
  status: string;
  authorName: string;
  subject: { id: string; name: string };
  section: { id: string; name: string; class: { name: string } };
};

export const homeworkView = (h: Row) => ({
  id: h.id,
  title: h.title,
  description: h.description,
  assignedOn: dayStr(h.assignedOn),
  dueOn: dayStr(h.dueOn),
  status: h.status,
  author: h.authorName,
  subjectId: h.subject.id,
  subject: h.subject.name,
  sectionId: h.section.id,
  classSection: `${h.section.class.name} ${h.section.name}`,
});

export const dayField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine(
    (v) => new Date(`${v}T00:00:00.000Z`).toISOString().slice(0, 10) === v,
    "That date does not exist",
  );
