import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { STAGES, TRANSITIONS, type Stage } from "@/server/admissions";
import { assertSameOrigin, handle } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  stage: z.enum(STAGES).optional(),
  notes: z.string().trim().max(1000).optional(),
});

/** Moves an enquiry along the pipeline. Skipping steps, reopening and "enrolled" are all refused here. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant(["school_owner", "principal"]);
  const { id } = await ctx.params;
  const b = Body.parse(await req.json());
  const a = await prisma.admission.findFirst({ where: { id, tenantId } });
  if (!a) throw new HttpError(404, "not_found", "Enquiry not found.");

  if (b.stage && b.stage !== a.stage) {
    if (b.stage === "enrolled")
      throw new HttpError(422, "use_admit", "Use the admit action to enrol a student.");
    if (!TRANSITIONS[a.stage as Stage].includes(b.stage))
      throw new HttpError(409, "bad_transition", `Cannot move from ${a.stage} to ${b.stage}.`);
  }
  await prisma.$transaction([
    prisma.admission.update({ where: { id }, data: { stage: b.stage, notes: b.notes } }),
    prisma.auditLog.create({
      data: {
        tenantId,
        userId: user.id,
        action: `admission.${b.stage ?? "note"}`,
        entity: "admission",
        entityId: id,
      },
    }),
  ]);
  return NextResponse.json({ ok: true, mode: "api", id, message: "Updated." });
});
