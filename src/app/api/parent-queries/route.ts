import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { ADMIN, dayStr, listOf } from "@/server/extras";
import { assertSameOrigin, handle } from "@/server/http";

/** The school sees every query; a parent sees only their own. */
export const GET = handle(async (req: Request) => {
  const { tenantId, user } = await requireTenant([...ADMIN, "parent"]);
  const status = new URL(req.url).searchParams.get("filter[status]");
  const rows = await prisma.parentQuery.findMany({
    where: {
      tenantId,
      ...(user.role === "parent" ? { userId: user.id } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { openedAt: "desc" },
  });
  return NextResponse.json(
    listOf(
      rows.map((q) => ({
        id: q.id,
        parent: q.parentName,
        subject: q.subject,
        body: q.body,
        reply: q.reply ?? "",
        assignedTo: q.assignedTo ?? "Not assigned",
        status: q.status,
        openedOn: dayStr(q.openedAt),
      })),
    ),
  );
});

const Body = z.object({
  subject: z.string().trim().min(3).max(120),
  body: z.string().trim().min(3).max(2000),
});

/** A parent asks the school a question. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["parent"]);
  const b = Body.parse(await req.json());
  const q = await prisma.parentQuery.create({
    data: { tenantId, userId: user.id, parentName: user.name, subject: b.subject, body: b.body },
  });
  return NextResponse.json(
    { ok: true, mode: "api", id: q.id, message: "Sent to the school." },
    { status: 201 },
  );
});
