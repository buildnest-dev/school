import { NextResponse } from "next/server";
import { HttpError, requireTenant } from "@/server/auth";
import { assertFileAccess } from "@/server/attachments";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

async function find(ctx: Ctx, write: boolean) {
  const { tenantId, user } = await requireTenant();
  const row = await prisma.attachment.findFirst({
    where: { id: (await ctx.params).id, tenantId },
  });
  if (!row) throw new HttpError(404, "not_found", "File not found.");
  await assertFileAccess(tenantId, user, row.entity as "student" | "material", row.entityId, write);
  return { row, user };
}

/** The file itself, always as a download so nothing in it runs inside the app. */
export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { row } = await find(ctx, false);
  return new Response(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.mime,
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { row, user } = await find(ctx, true);
  if (row.uploadedById !== user.id && !["school_owner", "principal"].includes(user.role))
    throw new HttpError(403, "forbidden", "Only the person who added it, or the school head.");
  await prisma.attachment.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true, message: "File removed." });
});
