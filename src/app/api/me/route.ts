import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  const { user } = await requireAuth();
  return NextResponse.json(user);
});
