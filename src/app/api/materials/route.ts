import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { CLASS_STAFF, classSubject, labelsFor, webLink } from "@/server/classwork";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** Study material shared with classes. A teacher sees their own; the principal and owner see all. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const rows = await prisma.studyMaterial.findMany({
    where: { tenantId, ...(user.role === "teacher" ? { createdById: user.id } : {}) },
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

const Body = z.object({
  sectionId: z.string().min(1),
  subjectId: z.string().min(1),
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().max(3000).default(""),
  link: webLink,
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...CLASS_STAFF]);
  const b = Body.parse(await req.json());
  await classSubject(tenantId, user, b.sectionId, b.subjectId);
  const m = await prisma.studyMaterial.create({
    data: { tenantId, ...b, createdById: user.id, authorName: user.name },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: m.id, message: "Shared with the class." },
    { status: 201 },
  );
});
