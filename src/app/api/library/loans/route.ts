import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { toDay, todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { DEFAULT_LOAN_DAYS, LIB_MANAGE, loanInclude, loanView, MAX_OPEN } from "@/server/library";

/**
 * Loans. Library staff: all loans (?status=open|overdue|returned, ?studentId=, ?staffId=, ?bookId=).
 * A parent: only their own children's loans. Teachers have no access.
 */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...LIB_MANAGE, "parent"]);
  const q = new URL(req.url).searchParams;
  const today = todayIST();
  const status = q.get("status");
  const parent = user.role === "parent";
  const kidIds = parent
    ? (
        await prisma.student.findMany({
          where: { tenantId, guardian: { userId: user.id } },
          select: { id: true },
        })
      ).map((k) => k.id)
    : [];
  const rows = await prisma.loan.findMany({
    where: {
      tenantId,
      ...(parent ? { studentId: { in: kidIds } } : {}),
      ...(q.get("studentId") ? { studentId: q.get("studentId")! } : {}),
      ...(q.get("staffId") && !parent ? { staffId: q.get("staffId")! } : {}),
      ...(q.get("bookId") && !parent ? { bookId: q.get("bookId")! } : {}),
      ...(status === "returned" ? { returnedOn: { not: null } } : {}),
      ...(status === "open" || status === "overdue" ? { returnedOn: null } : {}),
      ...(status === "overdue" ? { dueOn: { lt: toDay(today) } } : {}),
    },
    include: loanInclude,
    orderBy: [{ issuedOn: "desc" }, { id: "desc" }],
  });
  // A parent asking for one child must still be limited to their own children.
  const scoped = parent ? rows.filter((l) => l.studentId && kidIds.includes(l.studentId)) : rows;
  const items = scoped.map((l) => loanView(l, today));
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

const Body = z
  .object({
    bookId: z.string().min(1),
    studentId: z.string().min(1).optional(),
    staffId: z.string().min(1).optional(),
    dueDays: z.number().int().min(1).max(60).default(DEFAULT_LOAN_DAYS),
  })
  .refine((b) => Boolean(b.studentId) !== Boolean(b.staffId), {
    message: "Give exactly one borrower: studentId or staffId.",
    path: ["studentId"],
  });

/**
 * Issues a book. Refused when the book is retired or has no copy free, the borrower is not an
 * active member of this school, is at their limit, already holds this book, has an overdue book,
 * or has an unpaid fine. The copy is claimed atomically, so the last copy can never go to two people.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...LIB_MANAGE]);
  const b = Body.parse(await req.json());
  const today = todayIST();
  const kind = b.studentId ? "student" : "staff";

  const book = await prisma.book.findFirst({ where: { id: b.bookId, tenantId } });
  if (!book || book.status !== "active")
    throw new HttpError(422, "bad_book", "This book is not available in the catalogue.");
  const borrower = b.studentId
    ? await prisma.student.findFirst({ where: { id: b.studentId, tenantId, status: "active" } })
    : await prisma.staff.findFirst({ where: { id: b.staffId, tenantId, status: "active" } });
  if (!borrower) throw new HttpError(422, "bad_borrower", "Unknown or inactive borrower.");

  const who = b.studentId ? { studentId: b.studentId } : { staffId: b.staffId };
  const mine = await prisma.loan.findMany({ where: { tenantId, ...who } });
  const open = mine.filter((l) => l.returnedOn === null);
  if (open.some((l) => l.bookId === book.id))
    throw new HttpError(409, "already_has", `${borrower.name} already has this book.`);
  if (open.some((l) => l.dueOn < toDay(today)))
    throw new HttpError(
      409,
      "has_overdue",
      `${borrower.name} has an overdue book; return it first.`,
    );
  if (mine.some((l) => l.fineStatus === "due"))
    throw new HttpError(409, "unpaid_fine", `${borrower.name} has an unpaid library fine.`);
  if (open.length >= MAX_OPEN[kind])
    throw new HttpError(
      409,
      "limit",
      `${borrower.name} already has ${open.length} books out (limit ${MAX_OPEN[kind]}).`,
    );

  const due = new Date(Date.parse(today) + b.dueDays * 86400_000);
  const loan = await prisma.$transaction(async (tx) => {
    const claim = await tx.book.updateMany({
      where: { id: book.id, tenantId, status: "active", availableCopies: { gt: 0 } },
      data: { availableCopies: { decrement: 1 } },
    });
    if (claim.count !== 1) throw new HttpError(409, "no_copy", "No copy of this book is free.");
    return tx.loan.create({
      data: {
        tenantId,
        bookId: book.id,
        ...who,
        issuedOn: toDay(today),
        dueOn: due,
        issuedById: user.id,
      },
      include: loanInclude,
    });
  });
  await prisma.auditLog.create({
    data: { tenantId, userId: user.id, action: "library.issue", entity: "loan", entityId: loan.id },
  });
  return NextResponse.json(
    { ok: true, mode: "api", message: "Book issued.", loan: loanView(loan, today) },
    { status: 201 },
  );
});
