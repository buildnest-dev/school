"use client";

import {
  BookOpen,
  Bus,
  CalendarCheck,
  ChartColumn,
  ClipboardCheck,
  Coins,
  Library,
  Megaphone,
  RefreshCw,
  Route,
  BookText,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { BarList, PageHeader, StatGrid } from "@/components/shared/blocks";
import { WelcomeBanner, greeting } from "@/components/shared/welcome-banner";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { useSession } from "@/hooks/use-session";
import { todayIso } from "@/config/env";
import { linkOn } from "@/config/features";
import { firstName, fmtDate, todayLabel } from "../shared/format";

const QUICK_ICON: Record<string, LucideIcon> = {
  "/school/approvals": ClipboardCheck,
  "/school/reports": ChartColumn,
  "/school/rollover": RefreshCw,
  "/school/notices/new": Megaphone,
  "/school/attendance": CalendarCheck,
  "/school/fees": Coins,
  "/school/fees/ledger": BookText,
  "/school/fees/refunds": Undo2,
  "/school/library": Library,
  "/school/library/loans": BookOpen,
  "/school/transport": Bus,
  "/school/transport/routes": Route,
};

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
  vice_principal: [
    { href: "/school/attendance", label: "Attendance" },
    { href: "/school/timetable", label: "Timetable" },
    { href: "/school/students", label: "Students" },
  ],
  admission_officer: [
    { href: "/school/admissions", label: "Admissions" },
    { href: "/school/students", label: "Students" },
    { href: "/school/calendar", label: "Calendar" },
  ],
  hr: [
    { href: "/school/staff", label: "Staff" },
    { href: "/school/leave", label: "Staff leave" },
    { href: "/school/calendar", label: "Calendar" },
  ],
  reception: [
    { href: "/school/admissions", label: "Admissions" },
    { href: "/school/notices", label: "Notices" },
    { href: "/school/calendar", label: "Calendar" },
  ],
  accountant: [
    { href: "/school/fees", label: "Fee collection" },
    { href: "/school/fees/ledger", label: "Student ledger" },
    { href: "/school/fees/refunds", label: "Refunds" },
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
  const off = user?.disabledFeatures;
  const quick = (QUICK[role] ?? []).filter((q) => linkOn(q.href, off));
  const showAttendance =
    (role === "school_owner" || role === "principal" || role === "vice_principal") &&
    linkOn("/school/attendance", off);
  return (
    <>
      <WelcomeBanner
        eyebrow={todayLabel(todayIso())}
        title={`${greeting()}, ${firstName(user?.name ?? "")}!`}
        subtitle="Here is what needs your attention today."
        actions={quick.map((q) => (
          <Button key={q.href} asChild variant="light" size="sm">
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
        {(role === "school_owner" || role === "principal" || role === "accountant") &&
        (role !== "accountant" || linkOn("/school/fees", off)) ? (
          <Card>
            <CardHeader
              title="Waiting for a decision"
              action={
                <Button asChild variant="ghost" size="sm">
                  <Link href={role === "accountant" ? "/school/fees/refunds" : "/school/approvals"}>
                    {role === "accountant" ? "Open refunds" : "Open inbox"}
                  </Link>
                </Button>
              }
            />
            {data.pendingApprovals.length === 0 ? (
              <EmptyState title="Nothing waiting" />
            ) : (
              <ul className="grid gap-3">
                {data.pendingApprovals.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                    <Link
                      href={
                        a.kind === "Certificate"
                          ? "/school/certificates"
                          : a.kind === "Refund"
                            ? "/school/fees/refunds"
                            : "/school/approvals"
                      }
                      className="hover:underline"
                    >
                      <strong>{a.kind}</strong> · {a.subject}
                    </Link>
                    <StatusBadge status={a.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
        <Card className="lg:col-span-2">
          <CardHeader title="Quick actions" />
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
            {quick.map((q, i) => {
              const Icon = QUICK_ICON[q.href] ?? ClipboardCheck;
              const gold = i % 2 === 1;
              return (
                <li key={q.href}>
                  <Link
                    href={q.href}
                    className="border-line bg-surface hover:border-gold flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl border p-3 text-center text-sm font-semibold transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]"
                  >
                    <span
                      aria-hidden="true"
                      className={
                        gold
                          ? "grid size-10 place-items-center rounded-xl bg-[#f7dc9c] text-[#8a5a0c]"
                          : "grid size-10 place-items-center rounded-xl bg-[#d6efa4] text-[#2f6b12]"
                      }
                    >
                      <Icon className="size-5" />
                    </span>
                    {q.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
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
  // The overview answer carries no service list, so it is read from the status endpoint.
  const health = useAsync(() => s.platform.status(), [s]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock label="Loading the overview" />;
  const data = d.data;
  const total = data.tenantsByStatus.reduce((n, x) => n + x.count, 0) || 1;
  return (
    <>
      <WelcomeBanner
        title="Platform overview"
        subtitle="All schools on the platform. This view belongs to the software provider, not to any one school."
        badge="ZAQSA team"
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
            {(health.data ?? []).map((x) => (
              <li key={x.name} className="flex items-center justify-between gap-3">
                <span>{x.name}</span>
                <StatusBadge status={x.state} />
              </li>
            ))}
          </ul>
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
