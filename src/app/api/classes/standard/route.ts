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
  await prisma.$transaction(async (tx) => {
    for (const c of wanted) {
      let level = await tx.classLevel.findUnique({
        where: { tenantId_name: { tenantId, name: c.name } },
      });
      if (!level) {
        level = await tx.classLevel.create({
          data: {
            tenantId,
            campusId: campus?.id,
            name: c.name,
            stage: c.stage,
            position: c.position,
          },
        });
        classes++;
      }
      for (const name of b.sections) {
        const have = await tx.section.findUnique({
          where: { classId_name: { classId: level.id, name } },
        });
        if (!have) {
          await tx.section.create({ data: { tenantId, classId: level.id, name } });
          sections++;
        }
      }
    }
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
