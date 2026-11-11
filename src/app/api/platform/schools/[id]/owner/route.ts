import { NextResponse } from "next/server";
import { z } from "zod";
import { createLogin } from "@/server/accounts";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { hostsFor, requirePlatform } from "@/server/platform";
import { personName } from "@/server/validators";

const Body = z.object({
  ownerName: personName,
  ownerEmail: z.string().trim().toLowerCase().email(),
});

/**
 * POST: gives the school another owner login and e-mails them a link to set a password. Used when
 * the first owner e-mail was wrong or cannot be used (for example a ZAQSA team member's).
 */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(["customer_success"]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const t = await prisma.tenant.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "not_found", "School not found.");
  await createLogin(t.id, t.name, {
    email: b.ownerEmail,
    name: b.ownerName,
    role: "school_owner",
    origin: `https://${hostsFor(t.slug).school}`,
  });
  await prisma.auditLog.create({
    data: {
      tenantId: t.id,
      userId: user.id,
      action: "school.owner.add",
      entity: "tenant",
      entityId: t.id,
    },
  });
  return NextResponse.json(
    { ok: true, message: "The owner was invited by e-mail." },
    { status: 201 },
  );
});
