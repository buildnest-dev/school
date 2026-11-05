import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/** Reference list of education boards a school can pick from (national, international, open, state). */
export const GET = handle(async () => {
  await requireAuth();
  const boards = await prisma.board.findMany({ orderBy: [{ kind: "asc" }, { name: "asc" }] });
  return NextResponse.json(
    boards.map((b) => ({ id: b.id, code: b.code, name: b.name, kind: b.kind, state: b.stateCode })),
  );
});
