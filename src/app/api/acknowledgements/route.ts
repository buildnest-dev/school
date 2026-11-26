import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { dayStr } from "@/server/homework";
import { assertSameOrigin, handle } from "@/server/http";

/** Published notices, whether I have confirmed reading each, and (for leaders) who has. */
export const GET = handle(async () => {
  const { tenantId, user } = await requireTenant();
  const leader = user.role === "school_owner" || user.role === "principal";
  const notices = await prisma.notice.findMany({
    where: { tenantId, status: "published" },
    orderBy: { publishedAt: "desc" },
    take: 50,
  });
  const acks = await prisma.noticeAck.findMany({
    where: {
      tenantId,
      noticeId: { in: notices.map((n) => n.id) },
      ...(leader ? {} : { userId: user.id }),
    },
    orderBy: { at: "asc" },
  });
  return NextResponse.json(
    notices.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      publishedOn: n.publishedAt ? dayStr(n.publishedAt) : "",
      acknowledged: acks.some((a) => a.noticeId === n.id && a.userId === user.id),
      readers: leader ? acks.filter((a) => a.noticeId === n.id).map((a) => a.userName) : null,
    })),
  );
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant();
  const { noticeId } = z.object({ noticeId: z.string().min(1) }).parse(await req.json());
  const notice = await prisma.notice.findFirst({
    where: { id: noticeId, tenantId, status: "published" },
  });
  if (!notice) throw new HttpError(404, "not_found", "Notice not found.");
  await prisma.noticeAck.upsert({
    where: { noticeId_userId: { noticeId, userId: user.id } },
    create: { tenantId, noticeId, userId: user.id, userName: user.name },
    update: {},
  });
  return NextResponse.json({ ok: true, message: "Marked as read." });
});
