import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { handle } from "@/server/http";
import { vapidPublicKey } from "@/server/push";

/** GET: the public key a phone needs to subscribe. Null when notifications are not set up. */
export const GET = handle(async () => {
  await requireTenant();
  return NextResponse.json({ key: vapidPublicKey() });
});
