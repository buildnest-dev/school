import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { nextTicketNumber } from "@/server/platform";
import { NewTicket, assertStaff, seesAllTickets, ticketRow } from "@/server/support";

async function school() {
  const a = await requireAuth();
  assertStaff(a.user.role);
  if (!a.user.tenantId) throw new HttpError(403, "forbidden", "This is for school accounts.");
  return { user: a.user, tenantId: a.user.tenantId };
}

/** GET: the school's tickets (owner and principal see all; others see their own). */
export const GET = handle(async () => {
  const { user, tenantId } = await school();
  const rows = await prisma.supportTicket.findMany({
    where: { tenantId, ...(seesAllTickets(user.role) ? {} : { requesterId: user.id }) },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ items: rows.map(ticketRow), total: rows.length });
});

/**
 * POST: staff open a ticket with ZAQSA. This works even when the school's plan has lapsed,
 * because that is exactly when they need to reach us.
 */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { user, tenantId } = await school();
  throttle(`ticket|${user.id}`, 10, 60 * 60_000);
  const b = NewTicket.parse(await req.json());
  let ticket;
  for (let attempt = 0; ; attempt++) {
    try {
      ticket = await prisma.supportTicket.create({
        data: {
          number: await nextTicketNumber(),
          tenantId,
          requesterId: user.id,
          subject: b.subject,
          category: b.category,
          priority: b.priority,
          messages: { create: { authorId: user.id, body: b.body } },
        },
      });
      break;
    } catch (e) {
      if (attempt >= 3) throw e; // two requests took the same number; try the next one
    }
  }
  return NextResponse.json({ ok: true, mode: "api", ticket: ticketRow(ticket) }, { status: 201 });
});
