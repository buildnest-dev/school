import { NextResponse } from "next/server";
import { requireTenant } from "@/server/auth";
import { handle } from "@/server/http";

/** GET: syllabus coverage is not tracked yet, so this is honestly empty. */
export const GET = handle(async () => {
  await requireTenant(["teacher"]);
  return NextResponse.json([]);
});
