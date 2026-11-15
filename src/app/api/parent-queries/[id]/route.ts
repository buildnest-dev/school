import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  status: z.enum(["open", "in_progress", "resolved"]).optional(),
  reply: z.string().trim().max(2000).optional(),
});

/** The school takes a query, answers it and closes it. Whoever changes it becomes its handler. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...ADMIN]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const r = await prisma.parentQuery.updateMany({
    where: { id, tenantId },
    data: {
      ...(b.status ? { status: b.status } : {}),
      ...(b.reply !== undefined ? { reply: b.reply } : {}),
      assignedTo: user.name,
    },
  });
  if (!r.count) throw new HttpError(404, "not_found", "Query not found.");
  return NextResponse.json({ ok: true, mode: "api", message: "Saved." });
});
