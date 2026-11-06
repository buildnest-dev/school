import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { Reply, assertStaff, seesAllTickets } from "@/server/support";

/** POST: the school replies. A resolved ticket reopens; a closed one stays closed. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const a = await requireAuth();
  assertStaff(a.user.role);
  const { id } = await ctx.params;
  const b = Reply.parse(await req.json());
  const t = a.user.tenantId
    ? await prisma.supportTicket.findFirst({
        where: {
          id,
          tenantId: a.user.tenantId,
          ...(seesAllTickets(a.user.role) ? {} : { requesterId: a.user.id }),
        },
      })
    : null;
  if (!t) throw new HttpError(404, "not_found", "Ticket not found.");
  if (t.status === "closed") throw new HttpError(409, "closed", "This ticket is closed.");
  await prisma.$transaction([
    prisma.ticketMessage.create({ data: { ticketId: id, authorId: a.user.id, body: b.body } }),
    prisma.supportTicket.update({ where: { id }, data: { status: "open" } }),
  ]);
  return NextResponse.json({ ok: true, mode: "api" }, { status: 201 });
});
