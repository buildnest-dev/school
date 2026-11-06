import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { assertStaff, seesAllTickets, ticketRow } from "@/server/support";

/** GET: one ticket with its conversation. Internal ZAQSA notes are never included. */
export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const a = await requireAuth();
  assertStaff(a.user.role);
  const { id } = await ctx.params;
  const t = a.user.tenantId
    ? await prisma.supportTicket.findFirst({
        where: {
          id,
          tenantId: a.user.tenantId,
          ...(seesAllTickets(a.user.role) ? {} : { requesterId: a.user.id }),
        },
        include: { messages: { where: { internal: false }, orderBy: { createdAt: "asc" } } },
      })
    : null;
  if (!t) throw new HttpError(404, "not_found", "Ticket not found.");
  return NextResponse.json({
    ...ticketRow(t),
    messages: t.messages.map((m) => ({
      id: m.id,
      fromStaff: m.fromStaff,
      body: m.body,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});
