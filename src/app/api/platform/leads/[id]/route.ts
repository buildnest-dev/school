import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

const Body = z.object({
  stage: z.enum(["new", "contacted", "demo", "proposal", "won", "lost"]).optional(),
  /** true takes the lead for yourself; false releases it. */
  assignToMe: z.boolean().optional(),
  notes: z.string().trim().max(2000).optional(),
});

/** PATCH: moves a lead along the pipeline, takes it, or adds notes. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(["sales", "customer_success"]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new HttpError(404, "not_found", "Lead not found.");
  const updated = await prisma.lead.update({
    where: { id },
    data: {
      ...(b.stage ? { stage: b.stage } : {}),
      ...(b.notes !== undefined ? { notes: b.notes } : {}),
      ...(b.assignToMe !== undefined ? { ownerId: b.assignToMe ? user.id : null } : {}),
    },
  });
  return NextResponse.json({ ok: true, mode: "api", lead: updated });
});
