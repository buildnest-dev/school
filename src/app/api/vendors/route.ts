import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { like, prisma } from "@/server/db";
import { ADMIN_FIN, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

export const GET = handle(async (req: Request) => {
  const { tenantId } = await requireTenant([...ADMIN_FIN]);
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  const status = sp.get("filter[status]");
  const rows = await prisma.vendor.findMany({
    where: {
      tenantId,
      ...(status ? { status } : {}),
      ...(q ? { OR: [{ name: like(q) }, { category: like(q) }] } : {}),
    },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(
    listOf(
      rows.map((v) => ({
        id: v.id,
        name: v.name,
        category: v.category,
        contact: v.contact,
        status: v.status,
      })),
    ),
  );
});

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(60),
  contact: z.string().trim().max(120).default(""),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...ADMIN_FIN]);
  const b = Body.parse(await req.json());
  const v = await prisma.vendor.create({ data: { tenantId, ...b } });
  return NextResponse.json(
    { ok: true, mode: "api", id: v.id, message: "Vendor added." },
    { status: 201 },
  );
});
