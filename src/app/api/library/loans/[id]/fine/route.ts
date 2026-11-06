import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { todayIST } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";
import { LIB_MANAGE, loanInclude, loanView } from "@/server/library";

const Body = z.object({ status: z.enum(["paid", "waived"]) });

/**
 * Settles a fine that is "due". Marking it paid only records that the desk collected the cash
 * (no money moves through the system); waiving is for the owner or principal.
 */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...LIB_MANAGE]);
  const { id } = await ctx.params;
  const { status } = Body.parse(await req.json());
  if (status === "waived" && user.role === "librarian")
    throw new HttpError(403, "forbidden", "Only the principal or owner can waive a fine.");
  const claim = await prisma.loan.updateMany({
    where: { id, tenantId, fineStatus: "due" },
    data: { fineStatus: status },
  });
  if (claim.count !== 1) {
    const exists = await prisma.loan.findFirst({ where: { id, tenantId } });
    if (!exists) throw new HttpError(404, "not_found", "Loan not found.");
    throw new HttpError(409, "no_fine_due", "There is no unpaid fine on this loan.");
  }
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: `library.fine.${status}`,
      entity: "loan",
      entityId: id,
    },
  });
  const loan = await prisma.loan.findUniqueOrThrow({ where: { id }, include: loanInclude });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: status === "paid" ? "Fine marked as paid." : "Fine waived.",
    loan: loanView(loan, todayIST()),
  });
});
