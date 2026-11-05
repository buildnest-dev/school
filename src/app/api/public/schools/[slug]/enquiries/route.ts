import { NextResponse } from "next/server";
import { z } from "zod";
import { EnquiryBody } from "@/server/admissions";
import { HttpError } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";

/**
 * Public admission enquiry form for a school's website. No login, so it is abuse-limited:
 * per-IP throttle, a honeypot field, and the same validation as the staff form. It only ever
 * creates an enquiry in the "new" stage for an active school; it reads nothing back.
 */
const Body = EnquiryBody.omit({ source: true, notes: true }).extend({
  /** Honeypot: real people leave this empty. */
  website: z.string().max(0).optional(),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ slug: string }> }) => {
  assertSameOrigin(req);
  const { slug } = await ctx.params;
  throttle(`enq|${req.headers.get("x-forwarded-for") ?? "local"}`, 5, 10 * 60_000);
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) throw parsed.error;
  const { website: _hp, ...b } = parsed.data;
  void _hp;

  const tenant = await prisma.tenant.findFirst({
    where: { slug, status: { in: ["trial", "active"] } },
    select: { id: true },
  });
  if (!tenant) throw new HttpError(404, "not_found", "School not found.");
  if (b.applyingForId) {
    const c = await prisma.classLevel.findFirst({
      where: { id: b.applyingForId, tenantId: tenant.id },
    });
    if (!c) throw new HttpError(422, "bad_class", "Unknown class.");
  }
  await prisma.admission.create({
    data: { ...b, dob: b.dob ? new Date(b.dob) : null, tenantId: tenant.id, source: "website" },
  });
  return NextResponse.json(
    { ok: true, message: "Thank you. The school will contact you." },
    { status: 201 },
  );
});
