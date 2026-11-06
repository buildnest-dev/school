"use client";

import Link from "next/link";
import { useState } from "react";
import { BarList, DevNote, MonthCalendar, PageHeader, StatGrid } from "@/components/shared/blocks";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import type { Approval, Student } from "@/types";
import { fmtDate, rupees } from "../shared/format";
import type { ScreenProps } from "../shared/planned-screen";

/** Approve / reject routine requests, with confirmation. The backend must record and enforce the decision. */
export function ApprovalInbox() {
  const s = useServices();
  const { toast } = useToast();
  const list = useAsync(
    () => s.resource("approvals").list({ pageSize: 50, filters: { status: "pending" } }),
    [s],
  );
  const [pending, setPending] = useState<{ a: Approval; decision: "approved" | "rejected" } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const decide = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const res = await s.approvals.decide(pending.a.id, pending.decision);
      toast({
        title: `${pending.decision === "approved" ? "Approved" : "Rejected"}: ${pending.a.subject}`,
        description: res.message,
      });
      setPending(null);
      list.reload();
    } catch (e) {
      toast({
        title: "Couldn’t record the decision",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        title="Approval inbox"
        description="Requests waiting for a decision. Each decision asks you to confirm."
      />
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingBlock />
      ) : list.data.items.length === 0 ? (
        <EmptyState
          title="Nothing is waiting for you"
          hint="New requests from staff, parents and the office appear here."
        />
      ) : (
        <ul className="grid gap-3">
          {list.data.items.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">{a.subject}</p>
                  <p className="text-muted text-sm">
                    {a.kind} · requested by {a.requestedBy} on {fmtDate(a.requestedOn)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={a.status} />
                  <Button variant="ghost" onClick={() => setPending({ a, decision: "rejected" })}>
                    Reject
                  </Button>
                  <Button onClick={() => setPending({ a, decision: "approved" })}>Approve</Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-5">
        <DevNote>
          Decisions are kept in the development mock only. In production the backend records who
          decided, when, and enforces who is allowed to.
        </DevNote>
      </div>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={pending?.decision === "approved" ? "Approve this request?" : "Reject this request?"}
        description={pending ? `${pending.a.kind}: ${pending.a.subject}` : ""}
        confirmLabel={pending?.decision === "approved" ? "Approve" : "Reject"}
        busy={busy}
        onConfirm={decide}
      />
    </>
  );
}

export function CalendarScreen({ screen }: ScreenProps) {
  const s = useServices();
  const d = useAsync(() => s.resource("calendar").list({ pageSize: 200 }), [s]);
  return (
    <>
      <PageHeader title={screen.title} description={screen.description} />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock />
      ) : (
        <MonthCalendar events={d.data.items} initial={todayIso()} />
      )}
    </>
  );
}

export function StudentDetail({ params }: ScreenProps) {
  const s = useServices();
  const id = params.id ?? "";
  const st = useAsync(() => s.resource("students").get(id), [s, id]);
  const ledger = useAsync(() => s.ledger.forStudent(id), [s, id]);
  if (st.error) return <ErrorState message={st.error.message} onRetry={st.reload} />;
  if (st.loading && !st.data) return <LoadingBlock />;
  const stu = st.data as Student | null | undefined;
  if (!stu)
    return (
      <EmptyState
        title="Student not found"
        hint="This student isn’t in your school’s records."
        action={
          <Button asChild variant="ghost">
            <Link href="/school/students">Back to students</Link>
          </Button>
        }
      />
    );
  return (
    <>
      <PageHeader
        eyebrow={`Admission no. ${stu.admissionNo}`}
        title={stu.name}
        description={`Class ${stu.classSection} · Roll no. ${stu.rollNo}`}
        actions={<StatusBadge status={stu.status} />}
      />
      <Tabs defaultValue="overview">
        <TabsList aria-label="Student sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <StatGrid
            stats={[
              { label: "Attendance", value: `${stu.attendancePct}%` },
              {
                label: "Fees",
                value:
                  stu.feeStatus === "paid"
                    ? "Paid"
                    : stu.feeStatus === "partial"
                      ? "Part-paid"
                      : "Overdue",
              },
              { label: "Class", value: stu.classSection },
              { label: "Status", value: stu.status },
            ]}
          />
        </TabsContent>
        <TabsContent value="guardians">
          <Card className="max-w-lg">
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Guardian</dt>
                <dd className="font-medium">{stu.guardian}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Phone</dt>
                <dd className="font-medium">{stu.phone}</dd>
              </div>
            </dl>
          </Card>
        </TabsContent>
        <TabsContent value="fees">
          {ledger.data ? <LedgerTable rows={ledger.data} /> : <LoadingBlock rows={3} />}
        </TabsContent>
      </Tabs>
    </>
  );
}

export function LedgerTable({
  rows,
}: {
  rows: {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }[];
}) {
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Fee ledger</caption>
        <thead>
          <tr className="border-line bg-paper text-muted border-b text-xs tracking-wider uppercase">
            <th scope="col" className="px-4 py-3">
              Date
            </th>
            <th scope="col" className="px-4 py-3">
              Entry
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Charged
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Paid
            </th>
            <th scope="col" className="px-4 py-3 text-right">
              Balance
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-line border-b last:border-b-0">
              <td className="px-4 py-3">{fmtDate(r.date)}</td>
              <td className="px-4 py-3">{r.description}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.debit ? rupees(r.debit) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.credit ? rupees(r.credit) : "—"}
              </td>
              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                {rupees(r.balance)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FeesOverview() {
  const s = useServices();
  const svc = s.resource("invoices");
  const d = useAsync(() => s.dashboards.school("accountant"), [s]);
  return (
    <>
      <PageHeader title="Fee collection" description="Collection summary and invoices." />
      {d.data ? <StatGrid stats={d.data.stats} /> : null}
      <div className="mt-6">
        <DataTable
          caption="Invoices"
          searchPlaceholder="Search invoices"
          load={(p) => svc.list(p)}
          filters={[
            {
              key: "status",
              label: "Status",
              options: ["paid", "partial", "overdue", "pending"].map((v) => ({
                value: v,
                label: v[0]!.toUpperCase() + v.slice(1),
              })),
            },
          ]}
          columns={[
            { key: "number", header: "Invoice", sortable: true, render: (r) => r.number ?? r.id },
            { key: "studentName", header: "Student", sortable: true },
            { key: "classSection", header: "Class", hideOnMobile: true },
            { key: "amount", header: "Amount", sortable: true, render: (r) => rupees(r.amount) },
            { key: "paid", header: "Paid", render: (r) => rupees(r.paid) },
            {
              key: "due",
              header: "Due",
              sortable: true,
              render: (r) => fmtDate(r.due),
              hideOnMobile: true,
            },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          ]}
        />
      </div>
      <div className="mt-4">
        <DevNote>
          Recording payments, issuing receipts and refunds need the backend and a payment gateway.
          They are not available in this build, and no payment is ever confirmed by the screen
          alone.
        </DevNote>
      </div>
    </>
  );
}

export function FeeLedger() {
  const s = useServices();
  const students = useAsync(
    () => s.resource("students").list({ pageSize: 60, sort: "name", order: "asc" }),
    [s],
  );
  const [id, setId] = useState("");
  const ledger = useAsync(
    () => (id ? s.ledger.forStudent(id) : Promise.resolve(undefined)),
    [s, id],
  );
  return (
    <>
      <PageHeader
        title="Student ledger"
        description="Pick a student to see every charge and payment."
      />
      <div className="mb-5 max-w-sm">
        <label htmlFor="ledger-student" className="mb-1.5 block text-sm font-semibold">
          Student
        </label>
        <Select id="ledger-student" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose a student</option>
          {students.data?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.classSection}
            </option>
          ))}
        </Select>
      </div>
      {!id ? (
        <EmptyState title="No student chosen" hint="Choose a student above." />
      ) : ledger.error ? (
        <ErrorState message={ledger.error.message} onRetry={ledger.reload} />
      ) : !ledger.data ? (
        <LoadingBlock rows={3} />
      ) : (
        <LedgerTable rows={ledger.data} />
      )}
      <div className="mt-4">
        <DevNote>
          Carried-forward balances must link back to the year they came from. This sample ledger
          shows one year only.
        </DevNote>
      </div>
    </>
  );
}

export function AttendanceOverview() {
  const s = useServices();
  const d = useAsync(() => s.dashboards.school("principal"), [s]);
  const svc = s.resource("students");
  return (
    <>
      <PageHeader
        title="Attendance overview"
        description="Attendance by wing, and students whose attendance needs a follow-up."
      />
      {d.data ? (
        <Card className="mb-6 max-w-xl">
          <CardHeader title="Today by wing" />
          <BarList rows={d.data.attendanceByWing} />
        </Card>
      ) : null}
      <h2 className="mb-3 text-xl">Lowest attendance</h2>
      <DataTable
        caption="Students by attendance"
        searchPlaceholder="Search students"
        initialSort={{ key: "attendancePct", order: "asc" }}
        load={(p) => svc.list(p)}
        columns={[
          { key: "name", header: "Student", sortable: true },
          { key: "classSection", header: "Class", sortable: true },
          {
            key: "attendancePct",
            header: "Attendance",
            sortable: true,
            render: (r) => `${r.attendancePct}%`,
          },
          { key: "guardian", header: "Guardian", hideOnMobile: true },
          { key: "phone", header: "Phone", hideOnMobile: true },
        ]}
      />
    </>
  );
}

export function ResultsOverview() {
  return (
    <>
      <PageHeader
        title="Results overview"
        description="Publication status and grade spread (sample data)."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Result publication" />
          <ul className="grid gap-3 text-sm">
            {[
              ["Classes 1–5 · Unit Test 1", "published"],
              ["Classes 6–9 · Unit Test 1", "published"],
              ["Class 10B · Unit Test 1", "draft"],
              ["Class 12S · Unit Test 1", "draft"],
            ].map(([l, st]) => (
              <li key={l} className="flex items-center justify-between gap-3">
                <span>{l}</span>
                <StatusBadge status={st!} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Grade spread · Class 8" hint="Sample" />
          <BarList
            rows={[
              { label: "A", pct: 34 },
              { label: "B+", pct: 28 },
              { label: "B", pct: 22 },
              { label: "C", pct: 12 },
              { label: "D", pct: 4 },
            ]}
          />
        </Card>
      </div>
      <div className="mt-5">
        <DevNote>
          Marks moderation, report-card configuration and result publication are planned. Publishing
          must be done by the backend with approval.
        </DevNote>
      </div>
    </>
  );
}

export function Reports() {
  const reports = [
    {
      title: "Enrollment by wing",
      rows: [
        { label: "Primary", pct: 38, text: "476" },
        { label: "Middle", pct: 27, text: "337" },
        { label: "Secondary", pct: 22, text: "275" },
        { label: "Sr. Sec.", pct: 13, text: "160" },
      ],
    },
    {
      title: "Attendance this week",
      rows: [
        { label: "Mon", pct: 95 },
        { label: "Tue", pct: 94 },
        { label: "Wed", pct: 96 },
        { label: "Thu", pct: 93 },
      ],
    },
    {
      title: "Fees collected by term",
      rows: [
        { label: "Term 1", pct: 98 },
        { label: "Term 2", pct: 74 },
      ],
    },
    {
      title: "Teacher workload (periods/week)",
      rows: [
        { label: "Kavita I.", pct: 72, text: "29" },
        { label: "Arun D.", pct: 80, text: "32" },
        { label: "Priya S.", pct: 65, text: "26" },
      ],
    },
  ];
  return (
    <>
      <PageHeader
        title="Reports"
        description="A preview of the standard reports. Custom report building and exports are planned."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        {reports.map((r) => (
          <Card key={r.title}>
            <CardHeader title={r.title} hint="Sample data" />
            <BarList rows={r.rows} />
          </Card>
        ))}
      </div>
      <div className="mt-5">
        <Tabs defaultValue="a">
          <TabsList aria-label="Report builder">
            <TabsTrigger value="a">Custom report builder</TabsTrigger>
          </TabsList>
          <TabsContent value="a">
            <EmptyState
              title="Planned"
              hint="Choose fields, filters and grouping to build your own report. This needs the backend’s reporting API."
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
