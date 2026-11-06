import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { bookFields, bookView, LIB_MANAGE } from "@/server/library";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant();
  const b = await prisma.book.findFirst({ where: { id: (await ctx.params).id, tenantId } });
  const manager = (LIB_MANAGE as readonly string[]).includes(user.role);
  if (!b || (!manager && b.status !== "active"))
    throw new HttpError(404, "not_found", "Book not found.");
  return NextResponse.json(bookView(b));
});

const Patch = bookFields
  .partial()
  .extend({ status: z.enum(["active", "retired"]).optional() })
  .strict();

/**
 * Edit a book. Changing the number of copies keeps the available count right, and refuses to go
 * below the copies currently out. A book with copies out cannot be retired.
 */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...LIB_MANAGE]);
  const { id } = await ctx.params;
  const cur = await prisma.book.findFirst({ where: { id, tenantId } });
  if (!cur) throw new HttpError(404, "not_found", "Book not found.");
  const b = Patch.parse(await req.json());
  const out = cur.totalCopies - cur.availableCopies;

  if (b.status === "retired" && out > 0)
    throw new HttpError(409, "copies_out", "Copies of this book are still on loan.");
  if (b.totalCopies !== undefined && b.totalCopies < out)
    throw new HttpError(409, "copies_out", `${out} copies are on loan; the total cannot be lower.`);
  if (b.isbn && b.isbn !== cur.isbn) {
    const clash = await prisma.book.findFirst({ where: { tenantId, isbn: b.isbn } });
    if (clash) throw new HttpError(409, "duplicate", "Another book already has this ISBN.");
  }
  // Atomic: only apply the copy change if nobody issued a copy in the meantime.
  if (b.totalCopies !== undefined) {
    const delta = b.totalCopies - cur.totalCopies;
    const r = await prisma.book.updateMany({
      where: { id, tenantId, totalCopies: cur.totalCopies, availableCopies: cur.availableCopies },
      data: { totalCopies: b.totalCopies, availableCopies: cur.availableCopies + delta },
    });
    if (r.count !== 1)
      throw new HttpError(409, "changed", "The book changed while saving; please retry.");
  }
  const { totalCopies: _t, ...rest } = b;
  void _t;
  const book = await prisma.book.update({ where: { id }, data: rest });
  await prisma.auditLog.create({
    data: {
      tenantId,
      userId: user.id,
      action: "library.book.update",
      entity: "book",
      entityId: id,
    },
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    message: "Book updated.",
    book: bookView(book),
  });
});
