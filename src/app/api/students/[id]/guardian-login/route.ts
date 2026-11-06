import { NextResponse } from "next/server";
import { z } from "zod";
import { createLogin, originOf } from "@/server/accounts";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ email: z.string().trim().email().optional() });

/**
 * Creates the parent login for a student's guardian (the guardian then sees all their children
 * linked to that guardian record). The e-mail comes from the request or the guardian's record.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const body = Body.parse(await req.json().catch(() => ({})));
  const student = await prisma.student.findFirst({
    where: { id, tenantId },
    include: { guardian: true },
  });
  if (!student?.guardian) throw new HttpError(404, "not_found", "Student or guardian not found.");
  const g = student.guardian;
  if (g.userId) throw new HttpError(409, "has_login", "This guardian already has a login.");
  const email = body.email ?? g.email;
  if (!email)
    throw new HttpError(422, "email_required", "Give an e-mail address for the guardian.");

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const { userId } = await createLogin(tenantId, tenant.name, {
    email,
    name: g.name,
    role: "parent",
    origin: originOf(req),
  });
  await prisma.$transaction([
    prisma.guardian.update({
      where: { id: g.id },
      data: { userId, email: g.email ?? email.toLowerCase() },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "guardian.login",
        entity: "guardian",
        entityId: g.id,
      },
    }),
  ]);
  return NextResponse.json(
    { ok: true, mode: "api", message: "Parent login created. An invite was sent by e-mail." },
    { status: 201 },
  );
});
