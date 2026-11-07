import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { FEE_ROLES } from "@/server/fees";
import { handle } from "@/server/http";

/** GET: the screenshot. Staff of the school, or the parent who sent it. Never cached or shared. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const { tenantId, user } = await requireTenant([...FEE_ROLES, "parent"]);
  const { id } = await ctx.params;
  const p = await prisma.paymentProof.findFirst({
    where: {
      id,
      tenantId,
      ...(user.role === "parent" ? { student: { guardian: { userId: user.id } } } : {}),
    },
    select: { image: true },
  });
  if (!p) throw new HttpError(404, "not_found", "Not found.");
  return new Response(new Uint8Array(p.image), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
