import { NextResponse } from "next/server";
import { logout } from "@/server/auth";
import { assertSameOrigin, handle } from "@/server/http";

export const POST = handle(async (req: Request) => {
  assertSameOrigin(req);
  await logout();
  return NextResponse.json({ ok: true });
});
