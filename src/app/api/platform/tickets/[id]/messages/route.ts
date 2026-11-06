import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";
import { Reply } from "@/server/support";

const Body = Reply.extend({ internal: z.boolean().default(false) });

/** POST: staff reply (visible to the school) or internal note (staff only). */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(["support", "customer_success"]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const t = await prisma.supportTicket.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "not_found", "Ticket not found.");
  if (t.status === "closed") throw new HttpError(409, "closed", "This ticket is closed.");
  const msg = await prisma.$transaction(async (tx) => {
    const m = await tx.ticketMessage.create({
      data: {
        ticketId: id,
        authorId: user.id,
        fromStaff: true,
        internal: b.internal,
        body: b.body,
      },
    });
    // A visible reply means the school's turn: the ticket is waiting on them.
    await tx.supportTicket.update({
      where: { id },
      data: {
        assigneeId: t.assigneeId ?? user.id,
        ...(b.internal ? {} : { status: "pending" }),
      },
    });
    return m;
  });
  return NextResponse.json({ ok: true, mode: "api", message: msg }, { status: 201 });
});
