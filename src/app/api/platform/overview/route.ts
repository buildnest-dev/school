import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

type Group = { _count: number } & Record<string, unknown>;
const tally = (rows: Group[], key: string) =>
  Object.fromEntries(rows.map((r) => [String(r[key]), r._count]));

/** GET: headline numbers for the ZAQSA team's home screen. Counts only, no school records. */
export const GET = handle(async () => {
  const { platformRole } = await requirePlatform([
    "sales",
    "finance",
    "customer_success",
    "support",
    "product_manager",
    "marketing",
  ]);
  const [schools, leads, requests, tickets] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: true }),
    prisma.lead.groupBy({ by: ["stage"], _count: true }),
    prisma.provisioningRequest.groupBy({ by: ["status"], _count: true }),
    prisma.supportTicket.groupBy({ by: ["status"], _count: true }),
  ]);
  return NextResponse.json({
    yourRole: platformRole,
    schools: tally(schools, "status"),
    leads: tally(leads, "stage"),
    provisioning: tally(requests, "status"),
    tickets: tally(tickets, "status"),
  });
});
