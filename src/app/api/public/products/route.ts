import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** GET: the ZAQSA catalog for the public website (software products and services). */
export const GET = handle(async () => {
  const items = await prisma.product.findMany({
    where: { status: { not: "retired" } },
    orderBy: { position: "asc" },
  });
  return NextResponse.json({ items, total: items.length });
});
