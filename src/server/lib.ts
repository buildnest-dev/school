import { HttpError } from "./auth";
import { prisma } from "./db";

/** Parses YYYY-MM-DD into a UTC-midnight Date, rejecting impossible dates. */
export function parseDay(s: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
    throw new HttpError(400, "bad_date", "Date must be YYYY-MM-DD.");
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s)
    throw new HttpError(400, "bad_date", "That date does not exist.");
  return d;
}

/** A section (the frontend calls it a "class") is only visible if it belongs to the caller's school. */
export async function sectionOr404(tenantId: string, sectionId: string) {
  const s = await prisma.section.findFirst({
    where: { id: sectionId, tenantId },
    include: { class: true },
  });
  if (!s) throw new HttpError(404, "not_found", "Class not found.");
  return s;
}

export const sectionLabel = (s: { name: string; class: { name: string } }) =>
  `${s.class.name} ${s.name}`;

export async function roster(tenantId: string, sectionId: string) {
  const students = await prisma.student.findMany({
    where: { tenantId, sectionId, status: "active" },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return students.map((s, i) => ({ id: s.id, name: s.name, rollNo: i + 1 }));
}
