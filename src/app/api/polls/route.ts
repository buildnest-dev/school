import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { POLL_MANAGE, seesPoll } from "@/server/polls";

export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const manage = (POLL_MANAGE as readonly string[]).includes(user.role);
  const polls = (
    await prisma.poll.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 50 })
  ).filter((p) => manage || seesPoll(p.audience, user.role));
  const votes = await prisma.pollVote.findMany({
    where: { tenantId, pollId: { in: polls.map((p) => p.id) } },
  });
  return NextResponse.json(
    polls.map((p) => {
      const options = JSON.parse(p.options) as string[];
      const mine = votes.find((v) => v.pollId === p.id && v.userId === user.id);
      // Totals appear after voting, when the poll has closed, or to those who run it.
      const showCounts = manage || !!mine || p.status === "closed";
      return {
        id: p.id,
        question: p.question,
        audience: p.audience,
        status: p.status,
        options,
        myChoice: mine?.choice ?? null,
        counts: showCounts
          ? options.map((_, i) => votes.filter((v) => v.pollId === p.id && v.choice === i).length)
          : null,
      };
    }),
  );
});

const Body = z.object({
  question: z.string().trim().min(5).max(300),
  options: z.array(z.string().trim().min(1).max(120)).min(2).max(8),
  audience: z.enum(["all", "staff", "parents", "students"]),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant([...POLL_MANAGE]);
  const b = Body.parse(await req.json());
  await prisma.poll.create({
    data: { tenantId, ...b, options: JSON.stringify(b.options), createdById: user.id },
  });
  return NextResponse.json({ ok: true, message: "Poll published." }, { status: 201 });
});
