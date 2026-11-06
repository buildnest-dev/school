import { NextResponse } from "next/server";
import { like, prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

/** GET: leads from the website, newest first. Filter with ?stage= and ?q=. */
export const GET = handle(async (req: Request) => {
  await requirePlatform(["sales", "marketing", "customer_success"]);
  const sp = new URL(req.url).searchParams;
  const stage = sp.get("stage");
  const q = sp.get("q")?.trim();
  const items = await prisma.lead.findMany({
    where: {
      ...(stage ? { stage } : {}),
      ...(q
        ? {
            OR: [{ name: like(q) }, { email: like(q) }, { organisation: like(q) }],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ items, total: items.length });
});
