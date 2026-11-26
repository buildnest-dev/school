import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { classSubject, labelsFor } from "@/server/classwork";
import { prisma } from "@/server/db";
import { dayOf, dayStr, isoDay } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** A teacher's own lesson plans. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant(["teacher"]);
  const rows = await prisma.lessonPlan.findMany({
    where: { tenantId, createdById: user.id },
    orderBy: { plannedOn: "desc" },
  });
  const label = await labelsFor(tenantId);
  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      title: p.title,
      objectives: p.objectives,
      plannedOn: dayStr(p.plannedOn),
      status: p.status,
      ...label(p.sectionId, p.subjectId),
    })),
  );
});

const Body = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  objectives: z.string().trim().max(3000).default(""),
  plannedOn: isoDay,
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["teacher"]);
  const b = Body.parse(await req.json());
  await classSubject(tenantId, user, b.sectionId, b.subjectId);
  const p = await prisma.lessonPlan.create({
    data: { tenantId, ...b, plannedOn: dayOf(b.plannedOn), createdById: user.id },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: p.id, message: "Lesson planned." },
    { status: 201 },
  );
});
