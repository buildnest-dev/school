import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

/** The address with most of the name hidden: a***@example.com. */
const mask = (e: string) => e.replace(/^(.).*(@.*)$/, "$1***$2");

/**
 * GET /api/platform/mail-log: the last e-mails the system tried to send, with whether Brevo took
 * them and why not. No message text. For finding out why a mail did not arrive.
 */
export const GET = handle(async () => {
  await requirePlatform(["customer_success", "support"]);
  const rows = await prisma.outbox.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { toEmail: true, subject: true, status: true, error: true, createdAt: true },
  });
  return NextResponse.json({
    items: rows.map((r) => ({ ...r, toEmail: mask(r.toEmail) })),
  });
});
