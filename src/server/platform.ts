import { z } from "zod";
import { prisma } from "./db";
import { effectiveSubscription } from "./subscription";

const base = () => process.env.ZAQSA_BASE_DOMAIN ?? "zaqsa.com";

/** The two addresses every school gets: one for staff, one for parents and students. */
export const hostsFor = (slug: string) => ({
  school: `${slug}.school.${base()}`,
  parents: `${slug}.parents.${base()}`,
});

const RESERVED = new Set([
  "www",
  "admin",
  "schools",
  "school",
  "parents",
  "api",
  "app",
  "mail",
  "static",
  "support",
  "help",
  "billing",
  "status",
  "demo",
  "test",
]);

/** A school's name in its addresses: 3-30 lowercase letters, digits or hyphens, not reserved. */
export const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z][a-z0-9-]{1,28}[a-z0-9]$/, "Use 3-30 lowercase letters, digits or hyphens")
  .refine((v) => !RESERVED.has(v), "That name is reserved");

export const PLANS = ["trial", "starter", "growth", "premium"] as const;

export type CheckItem = { key: string; label: string; ok: boolean; detail: string };

/** What must be true before a school can go live. */
export async function goLiveChecklist(tenantId: string): Promise<CheckItem[]> {
  const [boards, year, classes, sections, staff, students, feeHeads, bank, owner] =
    await Promise.all([
      prisma.tenantBoard.count({ where: { tenantId } }),
      prisma.academicYear.count({ where: { tenantId, current: true } }),
      prisma.classLevel.count({ where: { tenantId } }),
      prisma.section.count({ where: { tenantId } }),
      prisma.staff.count({ where: { tenantId, status: "active" } }),
      prisma.student.count({ where: { tenantId, status: "active" } }),
      prisma.feeHead.count({ where: { tenantId } }),
      prisma.tenantBank.count({ where: { tenantId } }),
      prisma.membership.findFirst({
        where: { tenantId, role: "school_owner" },
        include: { user: { include: { tokens: true } } },
      }),
    ]);
  // The owner has accepted the invite once the invite link has been used.
  // An owner who already had an account at ZAQSA was never invited, so there is nothing to accept.
  const invites = owner?.user.tokens.filter((t) => t.purpose === "invite") ?? [];
  const ownerReady = !!owner && (invites.length === 0 || invites.some((t) => t.usedAt !== null));
  const item = (key: string, label: string, ok: boolean, detail: string): CheckItem => ({
    key,
    label,
    ok,
    detail,
  });
  return [
    item(
      "owner",
      "Owner has set a password",
      ownerReady,
      ownerReady ? "Done" : "Invite not accepted yet",
    ),
    item("boards", "Board chosen", boards > 0, `${boards} board(s)`),
    item("year", "Current academic year set", year > 0, year ? "Done" : "Missing"),
    item(
      "classes",
      "Classes and sections created",
      classes > 0 && sections > 0,
      `${classes} classes, ${sections} sections`,
    ),
    item("staff", "At least one staff member added", staff > 0, `${staff} active`),
    item("students", "Students added", students > 0, `${students} active`),
    item("fees", "Fee heads set up", feeHeads > 0, `${feeHeads} head(s)`),
    item("bank", "Bank details for payouts entered", bank > 0, bank ? "Done" : "Missing"),
  ];
}

export async function schoolRow(t: {
  id: string;
  slug: string;
  name: string;
  status: string;
  plan: string;
  planPeriod: string;
  subscription: string;
  periodEnd: Date | null;
  graceDays: number;
  maxStudents: number | null;
  wentLiveAt: Date | null;
  email: string | null;
  phone: string | null;
  createdAt: Date;
}) {
  return {
    id: t.id,
    slug: t.slug,
    name: t.name,
    status: t.status,
    plan: t.plan,
    planPeriod: t.planPeriod,
    subscription: effectiveSubscription(t),
    periodEnd: t.periodEnd?.toISOString().slice(0, 10) ?? null,
    graceDays: t.graceDays,
    maxStudents: t.maxStudents,
    wentLiveAt: t.wentLiveAt?.toISOString() ?? null,
    email: t.email,
    phone: t.phone,
    createdAt: t.createdAt.toISOString(),
    hosts: hostsFor(t.slug),
  };
}
