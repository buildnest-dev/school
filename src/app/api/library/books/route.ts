import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { like, prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { bookFields, bookView, LIB_MANAGE, nextAccessionNo } from "@/server/library";

/**
 * Catalogue. Everyone signed in to the school can browse it. Filters: ?q= (title/author/ISBN),
 * ?category=, ?available=1. Retired books are hidden unless the caller runs the library.
 */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant();
  const q = new URL(req.url).searchParams;
  const text = q.get("q")?.trim();
  const category = q.get("category");
  const manager = (LIB_MANAGE as readonly string[]).includes(user.role);
  const rows = await prisma.book.findMany({
    where: {
      tenantId,
      ...(manager ? {} : { status: "active" }),
      ...(category ? { category } : {}),
      ...(q.get("available") === "1" ? { availableCopies: { gt: 0 } } : {}),
      ...(text
        ? {
            OR: [
              { title: like(text) },
              { author: like(text) },
              { isbn: like(text.replace(/[\s-]/g, "")) },
            ],
          }
        : {}),
    },
    orderBy: { title: "asc" },
  });
  const items = rows.map(bookView);
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...LIB_MANAGE]);
  const b = bookFields.parse(await req.json());
  if (b.isbn && (await prisma.book.findFirst({ where: { tenantId, isbn: b.isbn } })))
    throw new HttpError(
      409,
      "duplicate",
      "A book with this ISBN is already in the catalogue; add copies to it instead.",
    );
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const book = await prisma.book.create({
        data: {
          tenantId,
          accessionNo: await nextAccessionNo(tenantId),
          title: b.title,
          author: b.author,
          isbn: b.isbn,
          category: b.category,
          shelf: b.shelf,
          totalCopies: b.totalCopies,
          availableCopies: b.totalCopies,
        },
      });
      await prisma.auditLog.create({
        data: {
          tenantId,
          userId: user.id,
          action: "library.book",
          entity: "book",
          entityId: book.id,
        },
      });
      return NextResponse.json(
        { ok: true, mode: "api", message: "Book added.", book: bookView(book) },
        { status: 201 },
      );
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002" || attempt === 2) throw e;
    }
  }
  throw new Error("unreachable");
});
