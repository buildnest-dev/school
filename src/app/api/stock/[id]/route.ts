import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { STOCK_ROLES } from "@/server/stock";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => new HttpError(404, "not_found", "Item not found.");

const Body = z.object({
  change: z
    .number()
    .int()
    .min(-100_000)
    .max(100_000)
    .refine((v) => v !== 0, "Enter how many came in or went out."),
  note: z.string().trim().max(200).default(""),
});

/** Stock in (positive) or out (negative). The count never goes below zero. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...STOCK_ROLES]);
  const id = (await ctx.params).id;
  const b = Body.parse(await req.json());
  await prisma.$transaction(async (tx) => {
    // The condition and the change are one statement, so two issues at once cannot overdraw.
    const { count } = await tx.stockItem.updateMany({
      where: { id, tenantId, ...(b.change < 0 ? { qty: { gte: -b.change } } : {}) },
      data: { qty: { increment: b.change } },
    });
    if (!count) {
      if (!(await tx.stockItem.findFirst({ where: { id, tenantId } }))) throw notFound();
      throw new HttpError(409, "not_enough", "There is not that much in stock.");
    }
    await tx.stockMove.create({
      data: { tenantId, itemId: id, change: b.change, note: b.note, byName: user.name },
    });
  });
  return NextResponse.json({ ok: true, message: "Stock updated." });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant(["school_owner", "principal"]);
  const { count } = await prisma.stockItem.deleteMany({
    where: { id: (await ctx.params).id, tenantId, qty: 0 },
  });
  if (!count) throw new HttpError(409, "not_empty", "Only an item with no stock can be removed.");
  return NextResponse.json({ ok: true, message: "Item removed." });
});
