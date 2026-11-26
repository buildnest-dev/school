import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { childFor } from "@/server/portal";
import { notifyUsers } from "@/server/push";

type Ctx = { params: Promise<{ id: string }> };

/** GET: notes teachers have sent about this child. Only the parent reads them. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { tenantId, user } = await requireTenant(["parent"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  const rows = await prisma.teacherMessage.findMany({
    where: { tenantId, studentId: child.id },
    orderBy: { sentAt: "desc" },
    take: 100,
  });
  return NextResponse.json(
    rows.map((m) => ({
      id: m.id,
      from: m.senderName,
      body: m.body,
      sentAt: m.sentAt.toISOString(),
      reply: m.reply,
    })),
  );
});

const Body = z.object({
  messageId: z.string().min(1),
  reply: z.string().trim().min(2).max(1000),
});

/** One answer to a teacher's note; sending again replaces it. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent"]);
  const child = await childFor(tenantId, user, (await ctx.params).id);
  await throttle(`reply|${user.id}`, 20, 10 * 60_000);
  const b = Body.parse(await req.json());
  const message = await prisma.teacherMessage.findFirst({
    where: { id: b.messageId, tenantId, studentId: child.id },
  });
  if (!message) throw new HttpError(404, "not_found", "Message not found.");
  await prisma.teacherMessage.update({
    where: { id: message.id },
    data: { reply: b.reply, repliedAt: new Date() },
  });
  await notifyUsers(tenantId, [message.senderUserId], {
    title: `Reply about ${child.name}`,
    body: b.reply.slice(0, 140),
    url: "/teacher/messages",
  });
  return NextResponse.json({ ok: true, message: "Reply sent." });
});
