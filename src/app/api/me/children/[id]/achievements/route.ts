import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  const rows = await prisma.achievement.findMany({
    where: { tenantId, studentId: child.id },
    orderBy: { awardedOn: "desc" },
  });
  return NextResponse.json(
    rows.map((a) => ({
      id: a.id,
      title: a.title,
      category: a.category,
      awardedOn: dayStr(a.awardedOn),
      note: a.note,
    })),
  );
});
