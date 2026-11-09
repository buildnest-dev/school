import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenant } from "@/server/auth";
import { prisma } from "@/server/db";
import { assertSameOrigin, handle, throttle } from "@/server/http";
import { isPushEndpoint } from "@/server/push";

const Sub = z.object({
  endpoint: z
    .string()
    .url()
    .max(2000)
    .refine(isPushEndpoint, "That is not a browser push address."),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(10).max(100) }),
});

/** POST: this phone agrees to receive notifications for the signed-in person. */
export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { tenantId, user } = await requireTenant();
  await throttle(`push|${user.id}`, 20, 10 * 60_000);
  const b = Sub.parse(await req.json());
  const data = {
    tenantId,
    userId: user.id,
    p256dh: b.keys.p256dh,
    auth: b.keys.auth,
    userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? null,
  };
  // The same phone can be handed to someone else, so the endpoint always follows the latest sign-in.
  await prisma.pushSubscription.upsert({
    where: { endpoint: b.endpoint },
    update: data,
    create: { endpoint: b.endpoint, ...data },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
});

/** DELETE: this phone stops receiving notifications. */
export const DELETE = handle(async (req: Request) => {
  assertSameOrigin(req);
  const { user } = await requireTenant();
  const { endpoint } = z.object({ endpoint: z.string().url().max(2000) }).parse(await req.json());
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } });
  return NextResponse.json({ ok: true });
});
