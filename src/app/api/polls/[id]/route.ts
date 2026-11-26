import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { POLL_MANAGE, seesPoll } from "@/server/polls";

type Ctx = { params: Promise<{ id: string }> };
const notFound = () => new HttpError(404, "not_found", "Poll not found.");

/** One vote each. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant();
  const { choice } = z.object({ choice: z.number().int().min(0) }).parse(await req.json());
  const poll = await prisma.poll.findFirst({ where: { id: (await ctx.params).id, tenantId } });
  if (!poll || !seesPoll(poll.audience, user.role)) throw notFound();
  if (poll.status !== "open") throw new HttpError(409, "closed", "This poll has closed.");
  if (choice >= (JSON.parse(poll.options) as string[]).length)
    throw new HttpError(422, "bad_choice", "Choose from the list.");
  try {
    await prisma.pollVote.create({ data: { tenantId, pollId: poll.id, userId: user.id, choice } });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new HttpError(409, "voted", "You have already voted.");
    throw e;
  }
  return NextResponse.json({ ok: true, message: "Vote recorded." });
});

/** Closes a poll. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId } = await requireTenant([...POLL_MANAGE]);
  const { count } = await prisma.poll.updateMany({
    where: { id: (await ctx.params).id, tenantId },
    data: { status: "closed" },
  });
  if (!count) throw notFound();
  return NextResponse.json({ ok: true, message: "Poll closed." });
});
