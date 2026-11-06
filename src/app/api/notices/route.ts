import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma, tenantDb } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

const STAFF = ["school_owner", "principal", "teacher", "accountant"];

export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant();
  const wanted = new URL(req.url).searchParams.get("filter[status]");
  const all = await tenantDb(tenantId).notices.list();
  // Staff see drafts; everyone else only sees published notices.
  const staff = STAFF.includes(user.role);
  const items = all
    .filter((n) => staff || n.status === "published")
    .filter((n) => !wanted || n.status === wanted)
    .map((n) => ({
      id: n.id,
      title: n.title,
      audience: n.audience,
      status: n.status,
      publishedOn: n.publishedAt?.toISOString().slice(0, 10) ?? null,
      author: n.authorName ?? "",
      body: n.body,
    }));
  return NextResponse.json({ items, total: items.length, page: 1, pageSize: items.length });
});

const Body = z.object({
  title: z.string().trim().min(3).max(120),
  body: z.string().trim().min(1).max(5000),
  audience: z.string().trim().min(1).max(60).default("all"),
  publish: z.boolean().default(false),
});

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const b = Body.parse(await req.json());
  const n = await prisma.notice.create({
    data: {
      tenantId,
      title: b.title,
      body: b.body,
      audience: b.audience,
      status: b.publish ? "published" : "draft",
      authorName: user.name,
      publishedAt: b.publish ? new Date() : null,
    },
  });
  return NextResponse.json({
    ok: true,
    mode: "api",
    id: n.id,
    message: b.publish ? "Notice published." : "Draft saved.",
  });
});
