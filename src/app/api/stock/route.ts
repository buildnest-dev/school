import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { STOCK_ROLES } from "@/server/stock";

export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...STOCK_ROLES]);
  const [items, moves] = await Promise.all([
    prisma.stockItem.findMany({ where: { tenantId }, orderBy: { name: "asc" } }),
    prisma.stockMove.findMany({ where: { tenantId }, orderBy: { at: "desc" }, take: 50 }),
  ]);
  const name = new Map(items.map((i) => [i.id, i.name]));
  return NextResponse.json({
    items: items.map((i) => ({
      id: i.id,
      name: i.name,
      category: i.category,
      unit: i.unit,
      qty: i.qty,
      minQty: i.minQty,
      low: i.qty <= i.minQty,
    })),
    moves: moves.map((m) => ({
      id: m.id,
      item: name.get(m.itemId) ?? "Removed item",
      change: m.change,
      note: m.note,
      by: m.byName,
      at: m.at.toISOString(),
    })),
  });
});

const Body = z.object({
  name: z.string().trim().min(2).max(100),
  category: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  qty: z.number().int().min(0).max(1_000_000).default(0),
  minQty: z.number().int().min(0).max(1_000_000).default(0),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...STOCK_ROLES]);
  const b = Body.parse(await req.json());
  if (await prisma.stockItem.findFirst({ where: { tenantId, name: b.name } }))
    throw new HttpError(409, "duplicate", "An item with this name already exists.");
  await prisma.$transaction(async (tx) => {
    const item = await tx.stockItem.create({ data: { tenantId, ...b } });
    if (b.qty)
      await tx.stockMove.create({
        data: {
          tenantId,
          itemId: item.id,
          change: b.qty,
          note: "Opening stock",
          byName: user.name,
        },
      });
  });
  return NextResponse.json({ ok: true, message: "Item added." }, { status: 201 });
});
