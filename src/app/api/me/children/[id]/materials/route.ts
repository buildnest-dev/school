import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { labelsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

/** GET: material shared with the child's class. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  if (!child.sectionId) return NextResponse.json([]);
  const rows = await prisma.studyMaterial.findMany({
    where: { tenantId, sectionId: child.sectionId },
    orderBy: { createdAt: "desc" },
  });
  const label = await labelsFor(tenantId);
  return NextResponse.json(
    rows.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      link: m.link,
      author: m.authorName,
      sharedOn: dayStr(m.createdAt),
      ...label(m.sectionId, m.subjectId),
    })),
  );
});
