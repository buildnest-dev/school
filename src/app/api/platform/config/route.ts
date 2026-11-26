import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { PLANS, requirePlatform } from "@/server/platform";

/** GET: how the platform is set up: address, plans and products. Read only; shows no secrets. */
export const GET = handle(async () => {
  await requirePlatform([
    "sales",
    "finance",
    "customer_success",
    "support",
    "product_manager",
    "marketing",
  ]);
  const [products, schools] = await Promise.all([
    prisma.product.findMany({ orderBy: { position: "asc" } }),
    prisma.tenant.groupBy({ by: ["plan"], _count: true }),
  ]);
  const used = new Map(schools.map((s) => [s.plan, s._count]));
  return NextResponse.json({
    baseDomain: process.env.ZAQSA_BASE_DOMAIN ?? "zaqsa.com",
    plans: PLANS.map((p) => ({ plan: p, schools: used.get(p) ?? 0 })),
    products: products.map((p) => ({ key: p.key, name: p.name, status: p.status })),
  });
});
