import type { SessionUser } from "@/types";
import { HttpError } from "./auth";
import { prisma } from "./db";

const isManager = (u: SessionUser) => u.role === "school_owner" || u.role === "principal";

/** The signed-in teacher's active staff record, if they have one. */
async function myStaff(tenantId: string, userId: string) {
  return prisma.staff.findFirst({
    where: { tenantId, userId, role: "teacher", status: "active" },
  });
}

/**
 * A teacher may work with a class (attendance, class lists) only if the timetable has them
 * teaching it, or they are its class teacher. The owner and principal may work with any class.
 */
export async function assertTeachesSection(tenantId: string, user: SessionUser, sectionId: string) {
  if (user.role !== "teacher") return;
  const me = await myStaff(tenantId, user.id);
  if (me) {
    const [teaches, classTeacher] = await Promise.all([
      prisma.period.findFirst({ where: { tenantId, staffId: me.id, sectionId } }),
      prisma.section.findFirst({ where: { id: sectionId, tenantId, classTeacherId: me.id } }),
    ]);
    if (teaches || classTeacher) return;
  }
  throw new HttpError(403, "not_your_class", "This is not one of your classes.");
}

/** Same, but for one subject (marks, homework): they must teach that subject in that class, or be its class teacher. */
export async function assertCanAssign(
  tenantId: string,
  user: SessionUser,
  sectionId: string,
  subjectId: string,
) {
  if (isManager(user)) return;
  const me = await myStaff(tenantId, user.id);
  if (me) {
    const [teaches, classTeacher] = await Promise.all([
      prisma.period.findFirst({ where: { tenantId, staffId: me.id, sectionId, subjectId } }),
      prisma.section.findFirst({ where: { id: sectionId, tenantId, classTeacherId: me.id } }),
    ]);
    if (teaches || classTeacher) return;
  }
  throw new HttpError(
    403,
    "not_your_class",
    "You can do this only for classes and subjects you teach.",
  );
}
