import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";
import { TICKET_PRIORITIES, TICKET_STATUSES, ticketRow } from "@/server/support";

const Body = z.object({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  assignToMe: z.boolean().optional(),
});
const ROLES = ["support", "customer_success"] as const;

export const GET = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requirePlatform(ROLES);
  const { id } = await ctx.params;
  const t = await prisma.supportTicket.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: "asc" } },
      tenant: { select: { name: true, slug: true } },
    },
  });
  if (!t) throw new HttpError(404, "not_found", "Ticket not found.");
  return NextResponse.json({
    ...ticketRow(t),
    school: t.tenant,
    assigneeId: t.assigneeId,
    messages: t.messages,
  });
});

/** PATCH: change status or priority, or take the ticket. */
export const PATCH = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requirePlatform(ROLES);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  if (!(await prisma.supportTicket.findUnique({ where: { id } })))
    throw new HttpError(404, "not_found", "Ticket not found.");
  const t = await prisma.supportTicket.update({
    where: { id },
    data: {
      ...(b.status ? { status: b.status } : {}),
      ...(b.priority ? { priority: b.priority } : {}),
      ...(b.assignToMe !== undefined ? { assigneeId: b.assignToMe ? user.id : null } : {}),
    },
  });
  return NextResponse.json({ ok: true, mode: "api", ticket: ticketRow(t) });
});
