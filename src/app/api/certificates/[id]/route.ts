import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { certInclude, certView } from "@/server/certificates";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** One certificate. The printable document is included once it has been issued. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "parent"]);
  const c = await prisma.certificate.findFirst({
    where: {
      id: (await ctx.params).id,
      tenantId,
      ...(user.role === "parent" ? { student: { guardian: { userId: user.id } } } : {}),
    },
    include: certInclude,
  });
  if (!c) throw new HttpError(404, "not_found", "Certificate not found.");
  return NextResponse.json(certView(c, true));
});
