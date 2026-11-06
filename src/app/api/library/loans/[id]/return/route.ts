import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { toDay, todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { daysLate, FINE_PER_DAY_PAISE, LIB_MANAGE, loanInclude, loanView } from "@/server/library";

const Body = z.object({ waiveFine: z.boolean().default(false) }).default({ waiveFine: false });

/**
 * Takes a book back. A late return records a fine (Rs 1 per day late) as "due"; the owner or
 * principal may waive it on the spot. The return is claimed atomically, so it cannot be counted twice.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...LIB_MANAGE]);
  const { id } = await ctx.params;
  const text = await req.text();
  const { waiveFine } = Body.parse(text ? JSON.parse(text) : undefined);
  if (waiveFine && user.role === "librarian")
    throw new HttpError(403, "forbidden", "Only the principal or owner can waive a fine.");

  const loan = await prisma.loan.findFirst({ where: { id, tenantId } });
  if (!loan) throw new HttpError(404, "not_found", "Loan not found.");
  const today = todayIST();
  const fine = daysLate(loan.dueOn, today) * FINE_PER_DAY_PAISE;

  await prisma.$transaction(async (tx) => {
    const claim = await tx.loan.updateMany({
      where: { id, tenantId, returnedOn: null },
      data: {
        returnedOn: toDay(today),
        finePaise: fine,
        fineStatus: fine === 0 ? "none" : waiveFine ? "waived" : "due",
      },
    });
    if (claim.count !== 1) throw new HttpError(409, "returned", "This book was already returned.");
    await tx.book.update({
      where: { id: loan.bookId },
      data: { availableCopies: { increment: 1 } },
    });
    await tx.auditLog.create({
      data: { tenantId, userId: user.id, action: "library.return", entity: "loan", entityId: id },
    });
  });
  const done = await prisma.loan.findUniqueOrThrow({ where: { id }, include: loanInclude });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: fine > 0 && !waiveFine ? "Returned late; a fine is due." : "Book returned.",
    loan: loanView(done, today),
  });
});
