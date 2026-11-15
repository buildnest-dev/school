import { z } from "zod";

/** Who runs the school side of calendar, leave, vendors, events, queries and the datesheet. */
export const ADMIN = ["school_owner", "principal"] as const;
export const ADMIN_FIN = ["school_owner", "principal", "accountant"] as const;

/** "2026-11-20" to midnight UTC, the way every other date in the database is stored. */
export const dayOf = (s: string) => new Date(`${s}T00:00:00.000Z`);
export const dayStr = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "");

export const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-11-20");

/** Roles that work at the school (as opposed to families). */
export const STAFF_ROLES = [
  "school_owner",
  "principal",
  "vice_principal",
  "admission_officer",
  "hr",
  "reception",
  "accountant",
  "librarian",
  "transport",
  "teacher",
] as const;

/** A list answer in the shape every table screen reads. */
export const listOf = <T>(items: T[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: items.length,
});
