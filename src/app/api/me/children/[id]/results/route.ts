import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";
import { sectionResults } from "@/server/reportcards";

type Ctx = { params: Promise<{ id: string }> };

/** GET: published marks, one row per subject and exam, with the grade the board gives. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  if (!child.sectionId) return NextResponse.json([]);
  const exams = await prisma.exam.findMany({
    where: { tenantId, published: true },
    orderBy: { name: "asc" },
  });
  const out: { subject: string; assessment: string; marks: number; max: number; grade: string }[] =
    [];
  for (const e of exams) {
    const r = await sectionResults(tenantId, e.id, child.sectionId);
    const mine = r?.cards.find((c) => c.studentId === child.id);
    for (const s of mine?.result.subjects ?? [])
      if (s.score !== null)
        out.push({
          subject: s.subject,
          assessment: e.name,
          marks: s.score,
          max: s.max,
          grade: s.grade ?? "",
        });
  }
  return NextResponse.json(out);
});
