import { NextResponse } from "next/server";
import { HttpError, requireAuth } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle } from "@/server/http";
import { goLiveChecklist } from "@/server/platform";

/** POST: moves a Provisioned school to Live, only when every checklist item is done. */
export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  assertSameOrigin(req);
  const { user } = await requireAuth(["platform_admin"]);
  const { id } = await ctx.params;
  const t = await prisma.tenant.findUnique({ where: { id } });
  if (!t) throw new HttpError(404, "not_found", "School not found.");
  if (t.status === "live") throw new HttpError(409, "already_live", "This school is already live.");
  if (t.status === "suspended")
    throw new HttpError(409, "suspended", "Reactivate the school before going live.");
  const checklist = await goLiveChecklist(id);
  const open = checklist.filter((c) => !c.ok);
  if (open.length)
    return NextResponse.json(
      {
        code: "checklist_incomplete",
        message: `${open.length} item(s) are still open: ${open.map((o) => o.label).join("; ")}.`,
        checklist,
      },
      { status: 409 },
    );
  await prisma.$transaction([
    prisma.tenant.update({ where: { id }, data: { status: "live", wentLiveAt: new Date() } }),
    prisma.auditLog.create({
      data: {
        tenantId: id,
        userId: user.id,
        action: "school.golive",
        entity: "tenant",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", message: "The school is live.", checklist });
});
