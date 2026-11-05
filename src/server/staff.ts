import { z } from "zod";
import { HttpError } from "./auth";
import { prisma } from "./db";
import { personName, phone } from "./validators";

export const STAFF_ROLES = [
  "teacher",
  "accountant",
  "admin",
  "librarian",
  "driver",
  "other",
] as const;

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "That date does not exist");

export const staffFields = z.object({
  name: personName,
  role: z.enum(STAFF_ROLES),
  designation: z.string().trim().max(80).optional(),
  department: z.string().trim().max(80).optional(),
  qualification: z.string().trim().max(120).optional(),
  phone: phone.optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  joinedOn: day.optional(),
});

/** Next employee number for the school: EMP-<year>-<0001...>. The unique index guards against races. */
export async function nextEmployeeNo(tenantId: string) {
  const prefix = `EMP-${new Date().getUTCFullYear()}-`;
  const last = await prisma.staff.findFirst({
    where: { tenantId, employeeNo: { startsWith: prefix } },
    orderBy: { employeeNo: "desc" },
    select: { employeeNo: true },
  });
  const n = last ? Number(last.employeeNo.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

/** Phone and email must be unique among a school's staff. */
export async function assertStaffContactFree(
  tenantId: string,
  c: { phone?: string; email?: string },
  exceptId?: string,
) {
  const or = [c.phone ? { phone: c.phone } : null, c.email ? { email: c.email } : null].filter(
    (x): x is NonNullable<typeof x> => x !== null,
  );
  if (!or.length) return;
  const clash = await prisma.staff.findFirst({
    where: { tenantId, OR: or, ...(exceptId ? { id: { not: exceptId } } : {}) },
  });
  if (clash)
    throw new HttpError(
      409,
      "duplicate",
      "A staff member with this phone or email already exists.",
    );
}

export const staffView = (s: {
  id: string;
  employeeNo: string;
  name: string;
  role: string;
  designation: string | null;
  department: string | null;
  qualification: string | null;
  phone: string | null;
  email: string | null;
  joinedOn: Date | null;
  status: string;
  userId: string | null;
}) => ({
  id: s.id,
  employeeNo: s.employeeNo,
  name: s.name,
  role: s.role,
  designation: s.designation,
  department: s.department,
  qualification: s.qualification,
  phone: s.phone,
  email: s.email,
  joinedOn: s.joinedOn?.toISOString().slice(0, 10) ?? null,
  status: s.status,
  hasLogin: s.userId !== null,
});

/** A staff id must belong to the school and be an active teacher to be put on the timetable. */
export async function activeTeacherOr422(tenantId: string, staffId: string) {
  const t = await prisma.staff.findFirst({ where: { id: staffId, tenantId } });
  if (!t) throw new HttpError(422, "bad_staff", "Unknown staff member.");
  if (t.role !== "teacher" || t.status !== "active")
    throw new HttpError(422, "not_teacher", `${t.name} is not an active teacher.`);
  return t;
}
