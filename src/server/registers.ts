import { z } from "zod";
import { moduleByKey, moduleRights, type ModuleDef } from "@/config/modules";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/types";
import { HttpError } from "./auth";
import { studentsFor } from "./classwork";
import { prisma } from "./db";

/** The register and what the signed-in person may do with it. Unknown and forbidden look alike. */
export function registerFor(key: string, user: SessionUser) {
  const def = moduleByKey(key);
  const rights = def && moduleRights(def, user.role);
  if (!def || !rights?.any) throw new HttpError(404, "not_found", "Register not found.");
  return { def, rights };
}
type Rights = ReturnType<typeof registerFor>["rights"];

const myStaffId = async (tenantId: string, userId: string) =>
  (await prisma.staff.findFirst({ where: { tenantId, userId }, select: { id: true } }))?.id;

/** Parents: their children. Students: themselves. */
export const ownStudentIds = async (tenantId: string, user: SessionUser) =>
  (
    await prisma.student.findMany({
      where: {
        tenantId,
        status: "active",
        ...(user.role === "parent" ? { guardian: { userId: user.id } } : { userId: user.id }),
      },
      select: { id: true },
    })
  ).map((s) => s.id);

/** The records this person is allowed to read, as a database filter. */
export async function readable(
  tenantId: string,
  user: SessionUser,
  def: ModuleDef,
  rights: Rights,
): Promise<Prisma.SchoolRecordWhereInput> {
  const base = { tenantId, module: def.key };
  if (rights.viewAll) return base;
  const or: Prisma.SchoolRecordWhereInput[] = [];
  if (rights.submit) or.push({ createdById: user.id });
  if (rights.family) or.push({ studentId: { in: await ownStudentIds(tenantId, user) } });
  if (rights.self) {
    const staffId = await myStaffId(tenantId, user.id);
    if (staffId) or.push({ staffId });
  }
  return or.length ? { ...base, OR: or } : { ...base, id: "none" };
}

/** The students the person may attach a record to. */
export async function studentChoices(tenantId: string, user: SessionUser, rights: Rights) {
  if (user.role === "parent" || user.role === "student") {
    const ids = await ownStudentIds(tenantId, user);
    return prisma.student.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, name: true },
    });
  }
  if (!rights.manage && !rights.submit) return [];
  // Teachers choose from their own classes; office staff from the whole school.
  return (await studentsFor(tenantId, user)).map((s) => ({
    id: s.id,
    name: s.classLabel ? `${s.name} · ${s.classLabel}` : s.name,
  }));
}

const RULES = {
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
    .refine((v) => !Number.isNaN(Date.parse(v)), "That date does not exist"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM"),
  link: z
    .string()
    .max(500)
    .regex(/^https:\/\/\S+$/i, "Use a link that starts with https://"),
};

/** Checks the sent field values; only the register's own fields that this person may set survive. */
export function readFields(
  def: ModuleDef,
  input: Record<string, unknown>,
  manage: boolean,
  partial: boolean,
) {
  const out: Record<string, string> = {};
  const errors: z.core.$ZodIssue[] = [];
  for (const field of def.fields) {
    if (!manage && (field.staffOnly || field.private)) continue;
    if (partial && !(field.key in input)) continue;
    const raw = input[field.key];
    const value = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
    const fail = (message: string) =>
      errors.push({ code: "custom", path: [field.key], message, input: raw });
    if (!value) {
      if (field.required && !(manage && field.staffOnly)) fail(`${field.label} is needed.`);
      else out[field.key] = "";
      continue;
    }
    if (value.length > 4000) fail("This is too long.");
    else if (field.type === "number" && !/^-?\d{1,12}(\.\d{1,2})?$/.test(value))
      fail("Enter a number.");
    else if (field.type === "select" && !field.options?.includes(value))
      fail("Choose from the list.");
    else if (field.type === "date" || field.type === "time" || field.type === "link") {
      const r = RULES[field.type].safeParse(value);
      if (!r.success) fail(r.error.issues[0]!.message);
      else out[field.key] = value;
    } else out[field.key] = value;
  }
  if (errors.length) throw new z.ZodError(errors);
  return out;
}

/** Refuses a booking that overlaps another live booking of the same thing on the same day. */
export async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  tenantId: string,
  def: ModuleDef,
  data: Record<string, string>,
  status: string,
  exceptId?: string,
) {
  const rule = def.noOverlap;
  if (!rule || rule.free.includes(status)) return;
  const from = data[rule.from]!;
  const to = data[rule.to]!;
  if (from >= to) throw new HttpError(422, "bad_time", "It must end after it starts.");
  const same = await tx.schoolRecord.findMany({
    where: {
      tenantId,
      module: def.key,
      onDate: data.date ? new Date(data.date) : null,
      status: { notIn: [...rule.free] },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
  });
  for (const r of same) {
    const d = JSON.parse(r.data) as Record<string, string>;
    if (d[rule.resource] === data[rule.resource] && from < d[rule.to]! && d[rule.from]! < to)
      throw new HttpError(
        409,
        "clash",
        `${d[rule.resource]} is already booked from ${d[rule.from]} to ${d[rule.to]}.`,
      );
  }
}

type Row = Prisma.SchoolRecordGetPayload<object>;

/** Records as the screen shows them, with private fields removed for everyone but managers. */
export async function viewRows(
  tenantId: string,
  user: SessionUser,
  def: ModuleDef,
  rights: Rights,
  rows: Row[],
) {
  const [students, staff] = await Promise.all([
    prisma.student.findMany({
      where: { tenantId, id: { in: rows.flatMap((r) => r.studentId ?? []) } },
      select: { id: true, name: true },
    }),
    prisma.staff.findMany({
      where: { tenantId, id: { in: rows.flatMap((r) => r.staffId ?? []) } },
      select: { id: true, name: true },
    }),
  ]);
  const name = new Map([...students, ...staff].map((x) => [x.id, x.name]));
  const hidden = new Set(def.fields.filter((f) => f.private).map((f) => f.key));
  return rows.map((r) => {
    const data = JSON.parse(r.data) as Record<string, string>;
    if (!rights.manage) for (const k of hidden) delete data[k];
    const mine = r.createdById === user.id && r.status === def.statuses[0] && rights.submit;
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      data,
      studentId: r.studentId,
      student: r.studentId ? (name.get(r.studentId) ?? "") : "",
      staffId: r.staffId,
      staff: r.staffId ? (name.get(r.staffId) ?? "") : "",
      by: r.createdByName,
      createdOn: r.createdAt.toISOString().slice(0, 10),
      canEdit: rights.manage || mine,
    };
  });
}
