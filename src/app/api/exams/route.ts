import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const staff = ["school_owner", "principal", "vice_principal", "teacher"].includes(user.role);
  const exams = await prisma.exam.findMany({
    where: { tenantId, ...(staff ? {} : { published: true }) },
    orderBy: { name: "asc" },
    include: { year: true },
  });
  return NextResponse.json(
    exams.map((e) => ({
      id: e.id,
      name: e.name,
      year: e.year.label,
      maxMarks: e.maxMarks,
      passPercent: e.passPercent,
      published: e.published,
      boardId: e.boardId,
    })),
  );
});

const Body = z.object({
  name: z.string().trim().min(2).max(60),
  maxMarks: z.number().int().min(1).max(1000).default(100),
  passPercent: z.number().int().min(0).max(100).default(33),
  /** Optional: grade this exam with another board's scale (the board must be one the school follows). */
  boardId: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal", "vice_principal"]);
  const b = Body.parse(await req.json());
  const year = await prisma.academicYear.findFirst({ where: { tenantId, current: true } });
  if (!year) throw new HttpError(409, "no_year", "Set the current academic year first.");
  if (b.boardId) {
    const link = await prisma.tenantBoard.findUnique({
      where: { tenantId_boardId: { tenantId, boardId: b.boardId } },
    });
    if (!link) throw new HttpError(422, "bad_board", "Your school does not follow that board.");
  }
  if (await prisma.exam.findFirst({ where: { tenantId, yearId: year.id, name: b.name } }))
    throw new HttpError(409, "duplicate", "An exam with this name already exists this year.");
  const e = await prisma.exam.create({ data: { ...b, tenantId, yearId: year.id } });
  await prisma.auditLog.create({
    data: { tenantId, userId: user.id, action: "exam.create", entity: "exam", entityId: e.id },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: e.id, message: "Exam created." },
    { status: 201 },
  );
});
