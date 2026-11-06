import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { childFor } from "@/server/portal";

type Ctx = { params: Promise<{ id: string }> };

/** GET: published homework for the class, with whether the teacher has marked it done. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent", "student"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  if (!child.sectionId) return NextResponse.json([]);
  const rows = await prisma.homework.findMany({
    where: { tenantId, sectionId: child.sectionId, status: "published" },
    include: { subject: { select: { name: true } }, rows: { where: { studentId: child.id } } },
    orderBy: [{ dueOn: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return NextResponse.json(
    rows.map((h) => ({
      id: h.id,
      subject: h.subject.name,
      title: h.title,
      due: h.dueOn.toISOString().slice(0, 10),
      status: h.rows[0]?.status === "done" ? "submitted" : "pending",
    })),
  );
});
