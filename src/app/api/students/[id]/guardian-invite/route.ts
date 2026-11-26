import { NextResponse } from "next/server";
import { originOf, resendInvite } from "@/server/accounts";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";

/** Sends the invite again to a student's parent who has a login. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const student = await prisma.student.findFirst({
    where: { id, tenantId },
    include: { guardian: true },
  });
  const userId = student?.guardian?.userId;
  if (!userId) throw new HttpError(404, "no_login", "This parent has no login yet.");
  await throttle(`invite|${userId}`, 3, 10 * 60_000);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  await resendInvite(tenantId, tenant.name, userId, originOf(req));
  await prisma.auditLog.create({
    data: { tenantId, userId: user.id, action: "guardian.invite", entity: "student", entityId: id },
  });
  return NextResponse.json({ ok: true, mode: "api", message: "Invite sent again." });
});
