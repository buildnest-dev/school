import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { STANDARD_CLASSES, sectionName } from "@/server/classes";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  /** Which classes to create. Pre-primary (Nursery, LKG, UKG) is optional. */
  includePrePrimary: z.boolean().default(true),
  upTo: z.number().int().min(1).max(12).default(12),
  sections: z.array(sectionName).min(1).max(10).default(["A"]),
});

/** POST: setup wizard shortcut. Creates the standard classes and sections; existing ones are kept. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const b = Body.parse(await req.json().catch(() => ({})));
  const wanted = STANDARD_CLASSES.map((c, position) => ({ ...c, position })).filter(
    (c) =>
      (b.includePrePrimary || c.stage !== "pre-primary") &&
      (c.stage === "pre-primary" || Number(c.name.slice(6)) <= b.upTo),
  );
  const campus = await prisma.campus.findFirst({ where: { tenantId }, orderBy: { name: "asc" } });
  let classes = 0;
  let sections = 0;
  // Few round trips on purpose: a remote database makes one query per class and section slow.
  await prisma.$transaction(async (tx) => {
    const names = wanted.map((c) => c.name);
    const existing = new Set(
      (await tx.classLevel.findMany({ where: { tenantId, name: { in: names } } })).map(
        (l) => l.name,
      ),
    );
    const fresh = wanted.filter((c) => !existing.has(c.name));
    if (fresh.length)
      await tx.classLevel.createMany({
        data: fresh.map((c) => ({
          tenantId,
          campusId: campus?.id,
          name: c.name,
          stage: c.stage,
          position: c.position,
        })),
      });
    classes = fresh.length;
    const levels = await tx.classLevel.findMany({
      where: { tenantId, name: { in: names } },
      include: { sections: true },
    });
    const rows = levels.flatMap((l) =>
      b.sections
        .filter((name) => !l.sections.some((x) => x.name === name))
        .map((name) => ({ tenantId, classId: l.id, name })),
    );
    if (rows.length) await tx.section.createMany({ data: rows });
    sections = rows.length;
    await tx.auditLog.create({
      data: { tenantId, userId: user.id, action: "classes.standard", entity: "classLevel" },
    });
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    classesCreated: classes,
    sectionsCreated: sections,
  });
});
