import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

const Body = z.object({
  status: z.enum(["verifying", "approved", "rejected", "provisioned"]),
  /** The workspace created for it; required to mark a school as provisioned. */
  tenantId: z.string().optional(),
  note: z.string().trim().max(1000).optional(),
});

const NEXT: Record<string, string[]> = {
  requested: ["verifying", "rejected"],
  verifying: ["approved", "rejected"],
  approved: ["provisioned", "rejected"],
  rejected: [],
  provisioned: [],
};

/** PATCH: verify, approve, reject, or mark provisioned. Only customer success decides. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user, platformRole } = await requirePlatform(["sales", "customer_success"]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  if (b.status !== "verifying" && platformRole === "sales")
    throw new HttpError(403, "forbidden", "Only customer success approves or rejects.");
  const r = await prisma.provisioningRequest.findUnique({ where: { id } });
  if (!r) throw new HttpError(404, "not_found", "Request not found.");
  if (!NEXT[r.status]!.includes(b.status))
    throw new HttpError(409, "bad_transition", `A ${r.status} request cannot become ${b.status}.`);
  if (b.status === "provisioned" && r.productKey === "school") {
    if (!b.tenantId || !(await prisma.tenant.findUnique({ where: { id: b.tenantId } })))
      throw new HttpError(422, "tenant_required", "Link the school workspace that was created.");
  }
  const updated = await prisma.provisioningRequest.update({
    where: { id },
    data: {
      status: b.status,
      note: b.note ?? r.note,
      tenantId: b.tenantId ?? r.tenantId,
      ...(b.status === "verifying" ? {} : { decidedById: user.id, decidedAt: new Date() }),
    },
  });
  return NextResponse.json({ ok: true, mode: "api", request: updated });
});
