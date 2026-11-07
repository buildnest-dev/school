"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { DataTable, type Column, type FilterDef } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { env } from "@/config/env";
import { useServices } from "@/hooks/use-services";
import { useSession } from "@/hooks/use-session";
import type { ResourceKey } from "@/services/types";
import type { Role } from "@/types";
import { CertificateActions } from "../school/certificate-actions";
import { fmtDate, prettyKey, rupees } from "./format";
import type { ScreenProps } from "./planned-screen";

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface TableConfig {
  resource: ResourceKey;
  columns: Column<any>[];
  filters?: FilterDef[];
  searchPlaceholder: string;
  fixedFilters?: Record<string, string>;
  /** Navigate instead of opening the details dialog. */
  rowHref?: (row: any) => string;
  actions?: (role: Role) => ReactNode;
  emptyHint?: string;
  /** Buttons under the details dialog; call done() after a change to reload the table. */
  detailActions?: (row: Record<string, unknown>, done: () => void) => ReactNode;
  initialSort?: { key: string; order: "asc" | "desc" };
}

const badge = (key: string) =>
  function BadgeCell(r: any) {
    return <StatusBadge status={String(r[key] ?? "")} />;
  };
const date = (key: string) => (r: any) => fmtDate(r[key]);
const opts = (...v: string[]): FilterDef["options"] =>
  v.map((x) => ({ value: x, label: prettyKey(x.replace(/_/g, " ")) }));

const SCHOOL_ADMIN: Role[] = ["school_owner", "principal"];

/** One entry per list-style screen: resource, columns, filters. Add a screen = add an entry here. */
export const TABLES: Record<string, TableConfig> = {
  "platform-tenants": {
    resource: "tenants",
    searchPlaceholder: "Search schools",
    columns: [
      { key: "name", header: "School", sortable: true },
      { key: "plan", header: "Plan", sortable: true },
      { key: "status", header: "Status", render: badge("status") },
      { key: "campuses", header: "Campuses", sortable: true },
      {
        key: "students",
        header: "Students",
        sortable: true,
        render: (r) => r.students.toLocaleString("en-IN"),
      },
      {
        key: "createdAt",
        header: "Since",
        sortable: true,
        render: date("createdAt"),
        hideOnMobile: true,
      },
    ],
    filters: [
      { key: "status", label: "Status", options: opts("active", "trial", "suspended") },
      { key: "plan", label: "Plan", options: opts("trial", "starter", "growth", "premium") },
    ],
  },
  "platform-onboarding": {
    resource: "onboarding",
    searchPlaceholder: "Search onboarding",
    columns: [
      { key: "tenant", header: "School", sortable: true },
      { key: "stage", header: "Current stage" },
      {
        key: "progressPct",
        header: "Progress",
        sortable: true,
        render: (r) => `${r.progressPct}%`,
      },
      { key: "owner", header: "Owner" },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [{ key: "status", label: "Status", options: opts("on_track", "blocked", "done") }],
  },
  "platform-subscriptions": {
    resource: "tenants",
    searchPlaceholder: "Search schools",
    columns: [
      { key: "name", header: "School", sortable: true },
      { key: "plan", header: "Plan", sortable: true },
      {
        key: "students",
        header: "Students used",
        sortable: true,
        render: (r) =>
          r.studentLimit
            ? `${r.students.toLocaleString("en-IN")} of ${r.studentLimit.toLocaleString("en-IN")}`
            : `${r.students.toLocaleString("en-IN")} (no limit)`,
      },
      {
        key: "usage",
        header: "Usage",
        render: (r) =>
          r.studentLimit ? `${Math.round((r.students / r.studentLimit) * 100)}%` : "-",
      },
      { key: "subscription", header: "Subscription", render: badge("subscription") },
    ],
    filters: [{ key: "plan", label: "Plan", options: opts("trial", "starter", "growth", "premium") }],
    emptyHint: "Pricing, billing periods and renewals are provided by the backend.",
  },
  "platform-support": {
    resource: "support",
    searchPlaceholder: "Search requests",
    columns: [
      { key: "subject", header: "Request", sortable: true },
      { key: "tenant", header: "School", sortable: true },
      { key: "priority", header: "Priority", render: badge("priority") },
      { key: "status", header: "Status", render: badge("status") },
      {
        key: "openedOn",
        header: "Opened",
        sortable: true,
        render: date("openedOn"),
        hideOnMobile: true,
      },
    ],
    filters: [
      { key: "status", label: "Status", options: opts("open", "in_progress", "closed") },
      { key: "priority", label: "Priority", options: opts("low", "normal", "high") },
    ],
  },
  "school-audit": {
    resource: "audit",
    searchPlaceholder: "Search history",
    initialSort: { key: "at", order: "desc" },
    columns: [
      { key: "at", header: "When", sortable: true },
      { key: "actor", header: "Who", sortable: true },
      { key: "action", header: "What" },
      { key: "target", header: "On" },
      { key: "area", header: "Area", hideOnMobile: true },
    ],
    filters: [
      {
        key: "area",
        label: "Area",
        options: opts("notices", "fees", "attendance", "certificates", "settings", "rollover"),
      },
    ],
  },
  "school-students": {
    resource: "students",
    searchPlaceholder: "Search by name, class or guardian",
    rowHref: (r) => `/school/students/${r.id}`,
    columns: [
      { key: "name", header: "Student", sortable: true },
      { key: "classSection", header: "Class", sortable: true },
      { key: "rollNo", header: "Roll no.", sortable: true, hideOnMobile: true },
      { key: "guardian", header: "Guardian", hideOnMobile: true },
      { key: "feeStatus", header: "Fees", render: badge("feeStatus") },
      {
        key: "attendancePct",
        header: "Attendance",
        sortable: true,
        render: (r) => `${r.attendancePct}%`,
      },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [
      { key: "status", label: "Status", options: opts("active", "pending", "transferred") },
      ...(env.dataSource === "api"
        ? []
        : [{ key: "feeStatus", label: "Fees", options: opts("paid", "partial", "overdue") }]),
    ],
  },
  "school-admissions": {
    resource: "enquiries",
    searchPlaceholder: "Search enquiries",
    columns: [
      { key: "studentName", header: "Child", sortable: true },
      { key: "applyingFor", header: "Applying for", sortable: true },
      { key: "guardian", header: "Guardian", hideOnMobile: true },
      { key: "source", header: "Source", hideOnMobile: true },
      { key: "stage", header: "Stage", render: badge("stage") },
      { key: "createdAt", header: "Received", sortable: true, render: date("createdAt") },
    ],
    filters: [
      {
        key: "stage",
        label: "Stage",
        options: opts("new", "documents", "review", "decision", "enrolled", "declined"),
      },
    ],
    emptyHint: "New enquiries from the website and walk-ins appear here.",
  },
  "school-staff": {
    resource: "staff",
    searchPlaceholder: "Search staff",
    columns: [
      { key: "name", header: "Name", sortable: true },
      { key: "role", header: "Role", sortable: true },
      { key: "department", header: "Department", sortable: true },
      { key: "phone", header: "Phone", hideOnMobile: true },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [{ key: "status", label: "Status", options: opts("active", "on_leave", "inactive") }],
  },
  "school-leave": {
    resource: "leaves",
    searchPlaceholder: "Search leave requests",
    columns: [
      { key: "staffName", header: "Staff", sortable: true },
      { key: "type", header: "Type" },
      { key: "from", header: "From", sortable: true, render: date("from") },
      { key: "to", header: "To", render: date("to") },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [{ key: "status", label: "Status", options: opts("pending", "approved", "rejected") }],
  },
  "school-campuses": {
    resource: "campuses",
    searchPlaceholder: "Search campuses",
    columns: [
      { key: "name", header: "Campus", sortable: true },
      { key: "principal", header: "Principal" },
      { key: "students", header: "Students", sortable: true },
      { key: "status", header: "Status", render: badge("status") },
    ],
  },
  "school-notices": {
    resource: "notices",
    searchPlaceholder: "Search notices",
    actions: (role) =>
      SCHOOL_ADMIN.includes(role) ? (
        <Button asChild>
          <Link href="/school/notices/new">Compose notice</Link>
        </Button>
      ) : null,
    columns: [
      { key: "title", header: "Notice", sortable: true },
      { key: "audience", header: "Audience", hideOnMobile: true },
      { key: "status", header: "Status", render: badge("status") },
      { key: "publishedOn", header: "Published", sortable: true, render: date("publishedOn") },
      { key: "author", header: "By", hideOnMobile: true },
    ],
    filters: [{ key: "status", label: "Status", options: opts("published", "draft") }],
  },
  "school-queries": {
    resource: "queries",
    searchPlaceholder: "Search queries",
    columns: [
      { key: "subject", header: "Query", sortable: true },
      { key: "parent", header: "Parent" },
      { key: "assignedTo", header: "Handled by" },
      { key: "status", header: "Status", render: badge("status") },
      {
        key: "openedOn",
        header: "Opened",
        sortable: true,
        render: date("openedOn"),
        hideOnMobile: true,
      },
    ],
    filters: [{ key: "status", label: "Status", options: opts("open", "in_progress", "resolved") }],
  },
  "school-events": {
    resource: "eventPlans",
    searchPlaceholder: "Search events",
    columns: [
      { key: "name", header: "Event", sortable: true },
      { key: "date", header: "Date", sortable: true, render: date("date") },
      { key: "owner", header: "Owner" },
      { key: "budget", header: "Budget", sortable: true, render: (r) => rupees(r.budget) },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [{ key: "status", label: "Status", options: opts("planning", "confirmed", "done") }],
  },
  "school-exams": {
    resource: "exams",
    searchPlaceholder: "Search the datesheet",
    columns: [
      { key: "date", header: "Date", sortable: true, render: date("date") },
      { key: "subject", header: "Subject", sortable: true },
      { key: "classSection", header: "Class" },
      { key: "kind", header: "Type", hideOnMobile: true },
      { key: "room", header: "Room" },
    ],
  },
  "school-fee-structure": {
    resource: "feeHeads",
    searchPlaceholder: "Search fee heads",
    columns: [
      { key: "name", header: "Fee head", sortable: true },
      { key: "classRange", header: "Applies to" },
      { key: "amount", header: "Amount", sortable: true, render: (r) => rupees(r.amount) },
      { key: "frequency", header: "Charged" },
    ],
  },
  "school-vendors": {
    resource: "vendors",
    searchPlaceholder: "Search vendors",
    columns: [
      { key: "name", header: "Vendor", sortable: true },
      { key: "category", header: "Category", sortable: true },
      { key: "contact", header: "Contact", hideOnMobile: true },
      { key: "status", header: "Status", render: badge("status") },
    ],
  },
  "school-certificates": {
    resource: "certificateRequests",
    searchPlaceholder: "Search requests",
    detailActions: (row, done) => <CertificateActions row={row} onDone={done} />,
    actions: (role) =>
      SCHOOL_ADMIN.includes(role) ? (
        <Button asChild>
          <Link href="/school/certificates/new">Generate certificate</Link>
        </Button>
      ) : null,
    columns: [
      { key: "studentName", header: "Student", sortable: true },
      { key: "type", header: "Certificate", sortable: true },
      { key: "classSection", header: "Class", hideOnMobile: true },
      { key: "requestedBy", header: "Requested by", hideOnMobile: true },
      { key: "status", header: "Status", render: badge("status") },
      { key: "requestedOn", header: "Requested", sortable: true, render: date("requestedOn") },
    ],
    filters: [
      {
        key: "status",
        label: "Status",
        options: opts("pending", "approved", "issued", "rejected"),
      },
      {
        key: "type",
        label: "Type",
        options: opts("Transfer", "Bonafide", "Character", "Study", "School leaving"),
      },
    ],
  },
  "school-certificate-register": {
    resource: "issueRegister",
    searchPlaceholder: "Search the register",
    detailActions: (row, done) => <CertificateActions row={row} onDone={done} />,
    columns: [
      { key: "certNo", header: "Certificate no.", sortable: true },
      { key: "type", header: "Type" },
      { key: "studentName", header: "Student", sortable: true },
      { key: "issuedOn", header: "Issued", sortable: true, render: date("issuedOn") },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [{ key: "status", label: "Status", options: opts("issued", "reissued", "cancelled") }],
  },
  "school-library": {
    resource: "books",
    searchPlaceholder: "Search by title, author or ISBN",
    columns: [
      { key: "title", header: "Title", sortable: true },
      { key: "author", header: "Author", sortable: true },
      { key: "isbn", header: "ISBN", hideOnMobile: true },
      { key: "copies", header: "Copies", sortable: true },
      {
        key: "available",
        header: "Available",
        sortable: true,
        render: (r) => (r.available === 0 ? <StatusBadge status="unavailable" /> : r.available),
      },
    ],
  },
  "school-library-loans": {
    resource: "loans",
    searchPlaceholder: "Search loans",
    columns: [
      { key: "book", header: "Book", sortable: true },
      { key: "member", header: "Member" },
      { key: "issued", header: "Issued", render: date("issued"), hideOnMobile: true },
      { key: "due", header: "Due", sortable: true, render: date("due") },
      { key: "status", header: "Status", render: badge("status") },
    ],
    filters: [{ key: "status", label: "Status", options: opts("issued", "overdue", "returned") }],
  },
  "school-transport": {
    resource: "vehicles",
    searchPlaceholder: "Search vehicles",
    columns: [
      { key: "regNo", header: "Registration", sortable: true },
      { key: "route", header: "Route" },
      { key: "driver", header: "Driver" },
      { key: "capacity", header: "Seats", sortable: true },
      { key: "status", header: "Status", render: badge("status") },
    ],
  },
  "school-routes": {
    resource: "routes",
    searchPlaceholder: "Search routes",
    columns: [
      { key: "name", header: "Route", sortable: true },
      { key: "stops", header: "Stops", sortable: true },
      { key: "students", header: "Students", sortable: true },
      { key: "vehicle", header: "Vehicle" },
    ],
    emptyHint: "Live GPS tracking is not connected.",
  },
  "teacher-notices": { ...noticeTable() },
  "parent-notices": { ...noticeTable() },
  "student-notices": { ...noticeTable() },
};

function noticeTable(): TableConfig {
  return {
    resource: "notices",
    searchPlaceholder: "Search notices",
    fixedFilters: { status: "published" },
    columns: [
      { key: "title", header: "Notice", sortable: true },
      { key: "audience", header: "For", hideOnMobile: true },
      { key: "publishedOn", header: "Published", sortable: true, render: date("publishedOn") },
      { key: "author", header: "From", hideOnMobile: true },
    ],
  };
}

export function ResourceTableScreen({ screen }: ScreenProps) {
  const cfg = TABLES[screen.id];
  const services = useServices();
  const { user } = useSession();
  const router = useRouter();
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  if (!cfg || !user) return null;
  const svc = services.resource(cfg.resource);
  return (
    <>
      <PageHeader
        title={screen.title}
        description={screen.description}
        actions={cfg.actions?.(user.role)}
      />
      <DataTable
        caption={screen.title}
        columns={cfg.columns}
        filters={cfg.filters}
        searchPlaceholder={cfg.searchPlaceholder}
        emptyHint={cfg.emptyHint}
        initialSort={cfg.initialSort}
        reloadKey={reloadKey}
        load={(p) => svc.list({ ...p, filters: { ...p.filters, ...cfg.fixedFilters } })}
        onRowClick={(row) =>
          cfg.rowHref
            ? router.push(cfg.rowHref(row))
            : setDetail(row as unknown as Record<string, unknown>)
        }
      />
      <Dialog
        open={detail !== null}
        onOpenChange={(o) => !o && setDetail(null)}
        title="Details"
        description={screen.title}
      >
        <dl className="grid gap-2 text-sm">
          {detail
            ? Object.entries(detail)
                .filter(([k]) => k !== "id")
                .map(([k, v]) => (
                  <div key={k} className="border-line flex justify-between gap-4 border-b pb-2">
                    <dt className="text-muted">{prettyKey(k)}</dt>
                    <dd className="text-right font-medium">{String(v ?? "—")}</dd>
                  </div>
                ))
            : null}
        </dl>
        {detail
          ? cfg.detailActions?.(detail, () => {
              setDetail(null);
              setReloadKey((k) => k + 1);
            })
          : null}
      </Dialog>
    </>
  );
}
