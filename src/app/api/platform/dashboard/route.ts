import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { handle } from "@/server/http";
import { requirePlatform } from "@/server/platform";

const label: Record<string, string> = {
  provisioned: "provisioned",
  live: "live",
  suspended: "suspended",
};

/**
 * GET: the ZAQSA team's home screen. Counts only: the team never sees a school's own records, so
 * there is no school audit trail here.
 */
export const GET = handle(async () => {
  await requirePlatform(["sales", "finance", "customer_success", "support", "product_manager", "marketing"]);
  const [byStatus, students, openTickets, newLeads] = await Promise.all([
    prisma.tenant.groupBy({ by: ["status"], _count: true }),
    prisma.student.count({ where: { status: "active" } }),
    prisma.supportTicket.count({ where: { status: { in: ["open", "pending"] } } }),
    prisma.lead.count({ where: { stage: "new" } }),
  ]);
  const schools = byStatus.reduce((n, r) => n + r._count, 0);
  const live = byStatus.find((r) => r.status === "live")?._count ?? 0;
  return NextResponse.json({
    stats: [
      { label: "Schools", value: String(schools), hint: `${live} live` },
      { label: "Active students", value: students.toLocaleString("en-IN") },
      { label: "Open support tickets", value: String(openTickets) },
      { label: "New demo requests", value: String(newLeads) },
    ],
    tenantsByStatus: byStatus.map((r) => ({ label: label[r.status] ?? r.status, count: r._count })),
    recentAudit: [],
    status: [],
  });
});
