import { prisma } from "./db";
import { DEFAULT_SCALE, GENERIC_SCALE, parseScale, type GradeBand } from "./grading";

/**
 * The scale used to grade an exam: the school's own override for that board if it set one,
 * else the board's stored default. With no board chosen, the school's default board, else CBSE.
 */
export async function effectiveScale(
  tenantId: string,
  boardId?: string | null,
): Promise<{ boardCode: string; scale: GradeBand[] }> {
  const links = await prisma.tenantBoard.findMany({
    where: { tenantId },
    include: { board: true },
  });
  const link = boardId
    ? links.find((l) => l.boardId === boardId)
    : (links.find((l) => l.isDefault) ?? links[0]);
  if (link) {
    const fallback = parseScale(link.board.gradeScale, GENERIC_SCALE);
    return { boardCode: link.board.code, scale: parseScale(link.gradeScale, fallback) };
  }
  return { boardCode: "CBSE", scale: DEFAULT_SCALE };
}
