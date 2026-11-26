import { readOff } from "@/config/features";
import { prisma } from "./db";
import { notifyUsers } from "./push";

/** Who in the office hears about a new student, what they are asked to do and where they go. */
const DESKS = [
  { role: "school_owner", who: "Owner", todo: "See the profile.", url: null, feature: null },
  { role: "principal", who: "Principal", todo: "See the profile.", url: null, feature: null },
  {
    role: "accountant",
    who: "Accountant",
    todo: "Raise the admission and tuition fee.",
    url: "/school/fees",
    feature: "fees",
  },
  {
    role: "librarian",
    who: "Librarian",
    todo: "A new library member can borrow books.",
    url: "/school/library/loans",
    feature: "library",
  },
  {
    role: "transport",
    who: "Transport in-charge",
    todo: "Give a bus route and stop.",
    url: "/school/transport/routes",
    feature: "transport",
  },
] as const;

export interface Informed {
  informed: string[];
  /** Desks nobody could be told about, because no one there has a login (or no class teacher is set). */
  missed: string[];
}

async function classTeacherUser(tenantId: string, sectionId: string | null) {
  if (!sectionId) return null;
  const section = await prisma.section.findFirst({ where: { id: sectionId, tenantId } });
  if (!section?.classTeacherId) return null;
  const staff = await prisma.staff.findFirst({
    where: { id: section.classTeacherId, tenantId, status: "active" },
  });
  return staff?.userId ?? null;
}

/** The desks whose feature this school has. */
async function activeDesks(tenantId: string) {
  const t = await prisma.tenant.findUniqueOrThrow({
    where: { id: tenantId },
    select: { disabledFeatures: true },
  });
  const off = readOff(t.disabledFeatures);
  return DESKS.filter((d) => !d.feature || !off.includes(d.feature));
}

const members = (tenantId: string) =>
  prisma.membership.findMany({
    where: { tenantId, role: { in: DESKS.map((d) => d.role) }, user: { active: true } },
    select: { userId: true, role: true },
  });

/**
 * Tells every desk that has work to do about one new student. Called after the admission is saved,
 * and never throws: a failed message must not undo or hide an admission.
 */
export async function announceAdmission(tenantId: string, studentId: string): Promise<Informed> {
  const out: Informed = { informed: [], missed: [] };
  try {
    const s = await prisma.student.findFirst({
      where: { id: studentId, tenantId },
      include: { section: { include: { class: true } } },
    });
    if (!s) return out;
    const cls = s.section ? `${s.section.class.name} ${s.section.name}` : "no class yet";
    const title = `New admission: ${s.name}`;
    const line = `${s.name} (${s.admissionNo}) joined ${cls}${s.needsBus ? " and will use the school bus" : ""}.`;
    const all = await members(tenantId);

    for (const d of await activeDesks(tenantId)) {
      if (d.role === "transport" && !s.needsBus) continue;
      const ids = all.filter((m) => m.role === d.role).map((m) => m.userId);
      if (!ids.length) {
        // A school runs fine with only an owner or only a principal, so the other is not "missed".
        if (d.role !== "school_owner") out.missed.push(d.who);
        continue;
      }
      await notifyUsers(tenantId, ids, {
        title,
        body: `${line} ${d.todo}`,
        url: d.url ?? `/school/students/${s.id}`,
      });
      out.informed.push(d.who);
    }

    const teacher = await classTeacherUser(tenantId, s.sectionId);
    if (teacher) {
      await notifyUsers(tenantId, [teacher], {
        title,
        body: `${line} Add them to your class register.`,
        url: "/teacher/classes",
      });
      out.informed.push("Class teacher");
    } else out.missed.push("Class teacher");
  } catch (e) {
    console.error("announceAdmission failed", e);
  }
  return out;
}

/** A bulk import sends one summary to each desk instead of one message per child. */
export async function announceImport(tenantId: string, sectionIds: string[]): Promise<void> {
  try {
    const count = sectionIds.length;
    if (!count) return;
    const title = count === 1 ? "1 new student added" : `${count} new students added`;
    const all = await members(tenantId);
    for (const d of await activeDesks(tenantId)) {
      // An import carries no bus choice, so transport has nothing to do yet.
      if (d.role === "transport") continue;
      await notifyUsers(
        tenantId,
        all.filter((m) => m.role === d.role).map((m) => m.userId),
        { title, body: `Added from a file. ${d.todo}`, url: d.url ?? "/school/students" },
      );
    }
    const perSection = new Map<string, number>();
    for (const id of sectionIds) perSection.set(id, (perSection.get(id) ?? 0) + 1);
    for (const [sectionId, n] of perSection) {
      const teacher = await classTeacherUser(tenantId, sectionId);
      if (teacher)
        await notifyUsers(tenantId, [teacher], {
          title: n === 1 ? "1 new student in your class" : `${n} new students in your class`,
          body: "Added from a file. Check your class register.",
          url: "/teacher/classes",
        });
    }
  } catch (e) {
    console.error("announceImport failed", e);
  }
}

/** One sentence for the person who admitted, so a gap is noticed at once. */
export function informedText({ informed, missed }: Informed) {
  return [
    informed.length ? `Informed: ${informed.join(", ")}.` : "",
    missed.length ? `Not informed (no login or not set): ${missed.join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
