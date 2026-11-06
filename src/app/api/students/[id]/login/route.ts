import { NextResponse } from "next/server";
import { z } from "zod";
import { createLogin, originOf } from "@/server/accounts";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ email: z.string().trim().email() });

/** Creates the student's own login (role "student"). Current students only. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const { email } = Body.parse(await req.json());
  const student = await prisma.student.findFirst({ where: { id, tenantId } });
  if (!student) throw new HttpError(404, "not_found", "Student not found.");
  if (student.status !== "active")
    throw new HttpError(409, "not_active", "Only current students get a login.");
  if (student.userId) throw new HttpError(409, "has_login", "This student already has a login.");

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const { userId } = await createLogin(tenantId, tenant.name, {
    email,
    name: student.name,
    role: "student",
    origin: originOf(req),
  });
  await prisma.$transaction([
    prisma.student.update({ where: { id }, data: { userId } }),
    prisma.auditLog.create({
      data: { tenantId, userId: user.id, action: "student.login", entity: "student", entityId: id },
    }),
  ]);
  return NextResponse.json(
    { ok: true, mode: "api", message: "Student login created. An invite was sent by e-mail." },
    { status: 201 },
  );
});
