import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";

/**
 * Development only: shows the e-mails the system "sent" (they go to the Outbox table because no
 * mail provider is connected). It answers 404 in production builds and whenever a mail provider
 * is configured, so reset links can never be read through it on a live site.
 */
export const GET = handle(async (req: Request) => {
  if (process.env.NODE_ENV === "production" || process.env.MAIL_PROVIDER)
    return NextResponse.json({ code: "not_found", message: "Not found." }, { status: 404 });
  const to = new URL(req.url).searchParams.get("to")?.trim().toLowerCase();
  if (!to) return NextResponse.json({ items: [] });
  const rows = await prisma.outbox.findMany({
    where: { toEmail: to },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  return NextResponse.json({
    items: rows.map((r) => ({ subject: r.subject, body: r.body, createdAt: r.createdAt })),
  });
});
