import { NextResponse } from "next/server";
import { requireAuth } from "@/server/auth";
import { handle } from "@/server/http";

export const GET = handle(async () => {
  const { user, mfaSetupRequired } = await requireAuth(undefined, { mfaExempt: true });
  return NextResponse.json(mfaSetupRequired ? { ...user, mfaSetupRequired: true } : user);
});
