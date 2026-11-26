import { NextResponse } from "next/server";
import { originOf, resendInvite } from "@/server/accounts";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";

/** Sends the invite again to a staff member who has a login. Principal invites: owner only. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const staff = await prisma.staff.findFirst({ where: { id, tenantId } });
  if (!staff?.userId) throw new HttpError(404, "no_login", "This person has no login yet.");
  if (staff.role === "principal" && user.role !== "school_owner")
    throw new HttpError(403, "owner_only", "Only the school owner can invite a principal.");
  await throttle(`invite|${staff.userId}`, 3, 10 * 60_000);
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  await resendInvite(tenantId, tenant.name, staff.userId, originOf(req));
  await prisma.auditLog.create({
    data: { tenantId, userId: user.id, action: "staff.invite", entity: "staff", entityId: id },
  });
  return NextResponse.json({ ok: true, mode: "api", message: "Invite sent again." });
});
