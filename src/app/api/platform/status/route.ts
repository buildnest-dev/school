import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

type State = "operational" | "degraded" | "unavailable";
const flag = (on: boolean, note: string, off: string): { state: State; note: string } =>
  on ? { state: "operational", note } : { state: "unavailable", note: off };

/** GET: which parts of the platform are switched on. Reads settings only; shows no secrets. */
export const GET = handle(async () => {
  await requirePlatform(["sales", "finance", "customer_success", "support", "product_manager", "marketing"]);
  let db: { state: State; note: string };
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = { state: "operational", note: "Responding" };
  } catch {
    db = { state: "unavailable", note: "Not responding" };
  }
  return NextResponse.json([
    { name: "Web application", state: "operational", note: "Running" },
    { name: "Database", ...db },
    { name: "Email", ...flag(!!process.env.BREVO_API_KEY, "Connected", "Not connected") },
    {
      name: "Phone notifications",
      ...flag(
        !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
        "Switched on",
        "Keys not set",
      ),
    },
    {
      name: "Team sign-in approval",
      ...flag(!!process.env.FIREBASE_SERVICE_ACCOUNT, "Admin approval required", "Not set up"),
    },
  ]);
});
