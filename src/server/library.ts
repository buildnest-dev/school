import { z } from "zod";
import { prisma } from "./db";
import { dayStr } from "./homework";

/** Library staff: they run the desk. Teachers and parents can only browse (parents see their own children's loans). */
export const LIB_MANAGE = ["school_owner", "principal", "librarian"] as const;

export const DEFAULT_LOAN_DAYS = 14;
export const FINE_PER_DAY_PAISE = 100; // Rs 1 per day late
export const MAX_OPEN = { student: 3, staff: 5 } as const;

export const CATEGORIES = [
  "Fiction",
  "Non-fiction",
  "Textbook",
  "Reference",
  "Biography",
  "History",
  "Science",
  "Children",
  "Magazine",
  "Other",
] as const;

/** Accepts ISBN-10 or ISBN-13 with or without hyphens/spaces and verifies the check digit. */
export function normaliseIsbn(raw: string): string | null {
  const s = raw.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + Number(c) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? s : null;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, c, i) => a + (c === "X" ? 10 : Number(c)) * (10 - i), 0);
    return sum % 11 === 0 ? s : null;
  }
  return null;
}

export const isbnField = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normaliseIsbn(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid ISBN-10 or ISBN-13" });
    return n ?? "";
  });

export const bookFields = z.object({
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(120),
  isbn: isbnField.optional(),
  category: z.enum(CATEGORIES),
  shelf: z.string().trim().max(30).optional(),
  totalCopies: z.number().int().min(1).max(500),
});

export async function nextAccessionNo(tenantId: string) {
  const last = await prisma.book.findFirst({
    where: { tenantId },
    orderBy: { accessionNo: "desc" },
    select: { accessionNo: true },
  });
  const n = last ? Number(last.accessionNo.slice(4)) + 1 : 1;
  return `LIB-${String(n).padStart(4, "0")}`;
}

export const bookView = (b: {
  id: string;
  accessionNo: string;
  title: string;
  author: string;
  isbn: string | null;
  category: string;
  shelf: string | null;
  totalCopies: number;
  availableCopies: number;
  status: string;
}) => ({
  id: b.id,
  accessionNo: b.accessionNo,
  title: b.title,
  author: b.author,
  isbn: b.isbn,
  category: b.category,
  shelf: b.shelf,
  totalCopies: b.totalCopies,
  availableCopies: b.availableCopies,
  status: b.status,
});

/** Whole days late (0 if returned on or before the due date). */
export function daysLate(dueOn: Date, until: string) {
  return Math.max(0, Math.round((Date.parse(until) - dueOn.getTime()) / 86400_000));
}

export const loanInclude = {
  book: { select: { id: true, title: true, accessionNo: true } },
  student: { select: { id: true, name: true } },
  staff: { select: { id: true, name: true } },
} as const;

export function loanView(
  l: {
    id: string;
    issuedOn: Date;
    dueOn: Date;
    returnedOn: Date | null;
    finePaise: number;
    fineStatus: string;
    book: { id: string; title: string; accessionNo: string };
    student: { id: string; name: string } | null;
    staff: { id: string; name: string } | null;
  },
  today: string,
) {
  const open = l.returnedOn === null;
  const late = open ? daysLate(l.dueOn, today) : 0;
  return {
    id: l.id,
    bookId: l.book.id,
    title: l.book.title,
    accessionNo: l.book.accessionNo,
    borrowerType: l.student ? "student" : "staff",
    borrowerId: (l.student ?? l.staff)?.id ?? null,
    borrower: (l.student ?? l.staff)?.name ?? "",
    issuedOn: dayStr(l.issuedOn),
    dueOn: dayStr(l.dueOn),
    returnedOn: l.returnedOn ? dayStr(l.returnedOn) : null,
    status: open ? (late > 0 ? "overdue" : "open") : "returned",
    daysLate: late,
    // Fine so far for an open overdue loan; the recorded fine once returned.
    fine: (open ? late * FINE_PER_DAY_PAISE : l.finePaise) / 100,
    fineStatus: l.fineStatus,
  };
}
