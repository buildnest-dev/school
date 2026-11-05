import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { validateScale } from "@/server/grading";
import { assertSameOrigin, handle } from "@/server/http";

const Body = z.object({
  /** null resets to the board default. */
  scale: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(8),
        from: z.number(),
        to: z.number(),
        remark: z.string().trim().max(40),
      }),
    )
    .nullable(),
});

/**
 * A school can adjust the grading scale for one of its boards (boards revise their schemes, and
 * schools often add their own bands). The scale must cover 0-100 with no gaps or overlaps.
 */
export const PUT = handle(async (req: Request, ctx: { params: Promise<{ boardId: string }> }) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { boardId } = await ctx.params;
  const { scale } = Body.parse(await req.json());
  const link = await prisma.tenantBoard.findUnique({
    where: { tenantId_boardId: { tenantId, boardId } },
  });
  if (!link) throw new HttpError(404, "not_found", "Your school does not follow this board.");
  if (scale) {
    const problem = validateScale(scale);
    if (problem) throw new HttpError(422, "bad_scale", problem);
  }
  await prisma.$transaction([
    prisma.tenantBoard.update({
      where: { tenantId_boardId: { tenantId, boardId } },
      data: { gradeScale: scale ? JSON.stringify(scale) : null },
    }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "boards.scale",
        entity: "board",
        entityId: boardId,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "Grading scale saved." });
});
