import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { GENERIC_SCALE, parseScale } from "@/server/grading";
import { assertSameOrigin, handle } from "@/server/http";

const MANAGE = ["school_owner", "principal"] as const;

/** The boards this school follows, with the grading scale currently in effect for each. */
export const GET = handle(async () => {
  const { tenantId } = await requireTenant([...MANAGE, "teacher", "accountant"]);
  const links = await prisma.tenantBoard.findMany({
    where: { tenantId },
    include: { board: true },
    orderBy: { board: { name: "asc" } },
  });
  return NextResponse.json(
    links.map((l) => ({
      boardId: l.boardId,
      code: l.board.code,
      name: l.board.name,
      isDefault: l.isDefault,
      customScale: l.gradeScale !== null,
      scale: parseScale(l.gradeScale, parseScale(l.board.gradeScale, GENERIC_SCALE)),
    })),
  );
});

const Body = z.object({
  boards: z
    .array(z.object({ boardId: z.string().min(1), isDefault: z.boolean().default(false) }))
    .min(1)
    .max(6),
});

/** Replaces the set of boards the school follows. Exactly one must be the default. Custom scales are kept. */
export const PUT = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...MANAGE]);
  const { boards } = Body.parse(await req.json());
  if (boards.filter((b) => b.isDefault).length !== 1)
    throw new HttpError(422, "one_default", "Choose exactly one default board.");
  if (new Set(boards.map((b) => b.boardId)).size !== boards.length)
    throw new HttpError(422, "duplicate", "A board is listed twice.");
  const known = await prisma.board.count({ where: { id: { in: boards.map((b) => b.boardId) } } });
  if (known !== boards.length) throw new HttpError(422, "bad_board", "Unknown board.");

  await prisma.$transaction([
    prisma.tenantBoard.deleteMany({
      where: { tenantId, boardId: { notIn: boards.map((b) => b.boardId) } },
    }),
    ...boards.map((b) =>
      prisma.tenantBoard.upsert({
        where: { tenantId_boardId: { tenantId, boardId: b.boardId } },
        update: { isDefault: b.isDefault },
        create: { tenantId, boardId: b.boardId, isDefault: b.isDefault },
      }),
    ),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: "boards.update",
        entity: "tenant",
        entityId: tenantId,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "Boards updated." });
});
