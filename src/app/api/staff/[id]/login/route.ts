import { NextResponse } from "next/server";
import { z } from "zod";
import { createLogin, originOf } from "@/server/accounts";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({ email: z.string().trim().email() });

/** Which login role each kind of staff member gets. Principal and owner are never granted here. */
const ROLE_FOR: Record<string, "teacher" | "accountant" | "librarian" | "transport"> = {
  teacher: "teacher",
  accountant: "accountant",
  librarian: "librarian",
  admin: "transport",
};

/**
 * Creates a login for a staff member and e-mails them a link to choose their own password; the
 * school never sees or sets it. Teachers, accountants, librarians and the transport in-charge only.
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const { email } = Body.parse(await req.json());
  const staff = await prisma.staff.findFirst({ where: { id, tenantId } });
  if (!staff) throw new HttpError(404, "not_found", "Staff member not found.");
  if (staff.status !== "active")
    throw new HttpError(409, "inactive", "This staff member is not active.");
  if (staff.userId) throw new HttpError(409, "has_login", "This staff member already has a login.");
  const role = ROLE_FOR[staff.role];
  if (!role)
    throw new HttpError(422, "no_login_role", "This kind of staff member does not get a login.");

  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  const { userId } = await createLogin(tenantId, tenant.name, {
    email,
    name: staff.name,
    role,
    origin: originOf(req),
  });
  await prisma.$transaction([
    prisma.staff.update({
      where: { id },
      data: { userId, email: staff.email ?? email.toLowerCase() },
    }),
    prisma.auditLog.create({
      data: { tenantId, userId: user.id, action: "staff.login", entity: "staff", entityId: id },
    }),
  ]);
  return NextResponse.json(
    { ok: true, mode: "api", message: "Login created. An invite was sent by e-mail." },
    { status: 201 },
  );
});
