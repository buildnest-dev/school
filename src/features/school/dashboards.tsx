"use client";

import Link from "next/link";
import { AuditHistory, BarList, PageHeader, StatGrid } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { useSession } from "@/hooks/use-session";
import { firstName, fmtDate } from "../shared/format";

const QUICK: Record<string, { href: string; label: string }[]> = {
  school_owner: [
    { href: "/school/approvals", label: "Approval inbox" },
    { href: "/school/reports", label: "Reports" },
    { href: "/school/rollover", label: "Year rollover" },
  ],
  principal: [
    { href: "/school/approvals", label: "Approval inbox" },
    { href: "/school/notices/new", label: "Compose notice" },
    { href: "/school/attendance", label: "Attendance" },
  ],
  accountant: [
    { href: "/school/fees", label: "Fee collection" },
    { href: "/school/fees/ledger", label: "Student ledger" },
    { href: "/school/certificates", label: "Certificate clearance" },
  ],
  librarian: [
    { href: "/school/library", label: "Catalogue" },
    { href: "/school/library/loans", label: "Issues & returns" },
  ],
  transport: [
    { href: "/school/transport", label: "Vehicles" },
    { href: "/school/transport/routes", label: "Routes" },
  ],
};

export function SchoolHome() {
  const s = useServices();
  const { user } = useSession();
  const role = user?.role ?? "principal";
  const d = useAsync(() => s.dashboards.school(role), [s, role]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock label="Loading the dashboard" />;
  const data = d.data;
  const showAttendance = role === "school_owner" || role === "principal";
  return (
    <>
      <PageHeader
        title={`Welcome, ${firstName(user?.name ?? "")}`}
        description="Here is what needs your attention today."
        actions={(QUICK[role] ?? []).map((q) => (
          <Button key={q.href} asChild variant="ghost" size="sm">
            <Link href={q.href}>{q.label}</Link>
          </Button>
        ))}
      />
      <StatGrid stats={data.stats} />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        {showAttendance ? (
          <Card>
            <CardHeader title="Attendance today" hint="By wing" />
            <BarList rows={data.attendanceByWing} />
          </Card>
        ) : null}
        {role === "school_owner" || role === "principal" || role === "accountant" ? (
          <Card>
            <CardHeader
              title="Waiting for a decision"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href="/school/approvals">Open inbox</Link>
                </Button>
              }
            />
            {data.pendingApprovals.length === 0 ? (
              <EmptyState title="Nothing waiting" />
            ) : (
              <ul className="grid gap-3">
                {data.pendingApprovals.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <span>
                      <strong>{a.kind}</strong> · {a.subject}
                    </span>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
        <Card className={showAttendance ? "lg:col-span-2" : ""}>
          <CardHeader title="Coming up" />
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            {data.upcoming.map((e) => (
              <li key={e.id} className="border-line flex justify-between gap-3 border-b pb-2">
                <span>{e.title}</span>
                <span className="text-muted">{fmtDate(e.date)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

export function PlatformHome() {
  const s = useServices();
  const d = useAsync(() => s.dashboards.platform(), [s]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock label="Loading the overview" />;
  const data = d.data;
  const total = data.tenantsByStatus.reduce((n, x) => n + x.count, 0) || 1;
  return (
    <>
      <PageHeader
        title="Platform overview"
        description="All schools on the platform. This view belongs to the software provider, not to any one school."
      />
      <StatGrid stats={data.stats} />
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Schools by status" />
          <BarList
            rows={data.tenantsByStatus.map((x) => ({
              label: x.label[0]!.toUpperCase() + x.label.slice(1),
              pct: Math.round((x.count / total) * 100),
              text: String(x.count),
            }))}
          />
        </Card>
        <Card>
          <CardHeader
            title="Service health"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/platform/status">Details</Link>
              </Button>
            }
          />
          <ul className="grid gap-3 text-sm">
            {data.status.map((x) => (
              <li key={x.name} className="flex items-center justify-between gap-3">
                <span>{x.name}</span>
                <StatusBadge status={x.state} />
              </li>
            ))}
          </ul>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent activity"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/platform/audit">All activity</Link>
              </Button>
            }
          />
          <AuditHistory entries={data.recentAudit} />
        </Card>
      </div>
    </>
  );
}

export function PlatformStatus() {
  const s = useServices();
  const d = useAsync(() => s.platform.status(), [s]);
  return (
    <>
      <PageHeader
        title="System status"
        description="Integrations marked “Not connected” are not available yet. Nothing here pretends otherwise."
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock />
      ) : (
        <ul className="grid max-w-2xl gap-3">
          {d.data.map((x) => (
            <li key={x.name}>
              <Card className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{x.name}</span>
                  <span className="text-muted text-sm">{x.note}</span>
                </span>
                <StatusBadge status={x.state} />
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
