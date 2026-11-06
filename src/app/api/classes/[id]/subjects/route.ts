import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { subjectNames } from "@/server/classes";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ names: subjectNames });

/** POST: adds subjects to a class. Names that already exist for that class are skipped. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  if (!(await prisma.classLevel.findFirst({ where: { id, tenantId } })))
    throw new HttpError(404, "not_found", "Class not found.");
  const { names } = Body.parse(await req.json());
  const have = new Set(
    (await prisma.subject.findMany({ where: { tenantId, classId: id } })).map((s) =>
      s.name.toLowerCase(),
    ),
  );
  const fresh = [...new Set(names)].filter((n) => !have.has(n.toLowerCase()));
  await prisma.$transaction([
    prisma.subject.createMany({ data: fresh.map((name) => ({ tenantId, classId: id, name })) }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "subjects.add",
        entity: "classLevel",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", added: fresh.length }, { status: 201 });
});
