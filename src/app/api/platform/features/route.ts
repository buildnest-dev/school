import { NextResponse } from "next/server";
import { readOff } from "@/config/features";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

/** GET: every school with the features switched off for it. */
export const GET = handle(async () => {
  await requirePlatform([
    "sales",
    "finance",
    "customer_success",
    "support",
    "product_manager",
    "marketing",
  ]);
  const schools = await prisma.tenant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, plan: true, disabledFeatures: true },
  });
  return NextResponse.json({
    schools: schools.map((s) => ({
      id: s.id,
      name: s.name,
      plan: s.plan,
      disabled: readOff(s.disabledFeatures),
    })),
  });
});
