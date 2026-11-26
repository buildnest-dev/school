"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { AREA_ROOT, ROLE_AREA } from "@/config/screens";
import { todayIso } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { downloadCsv } from "../shared/csv";
import { rupees } from "../shared/format";
import { sampleId, useData } from "../shared/use-data";
import { linesText, readLines, type PayLine } from "./pay-lines";

interface PayRow {
  staffId: string;
  name: string;
  employeeNo: string;
  earnings: PayLine[];
  deductions: PayLine[];
  net: number;
  slip: { id: string; status: "draft" | "paid"; net: number } | null;
}
interface Payroll {
  month: string;
  rows: PayRow[];
}

const samplePayroll = (month: string): Payroll => ({
  month,
  rows: [
    {
      staffId: "s-1",
      name: "Kavita Iyer",
      employeeNo: "EMP-001",
      earnings: [
        { label: "Basic", rupees: 28000 },
        { label: "Allowance", rupees: 6000 },
      ],
      deductions: [{ label: "Advance", rupees: 1000 }],
      net: 33000,
      slip: { id: "ps-1", status: "paid", net: 33000 },
    },
    {
      staffId: "s-2",
      name: "Arjun Menon",
      employeeNo: "EMP-002",
      earnings: [],
      deductions: [],
      net: 0,
      slip: null,
    },
  ],
});

function SalaryForm({
  row,
  busy,
  onSave,
}: {
  row: PayRow;
  busy: boolean;
  onSave: (earnings: PayLine[], deductions: PayLine[]) => void;
}) {
  const [earn, setEarn] = useState(linesText(row.earnings));
  const [cut, setCut] = useState(linesText(row.deductions));
  const e = readLines(earn);
  const c = readLines(cut);
  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    if (e && c) onSave(e, c);
  };
  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field id="pay-e" label="Earnings" hint="One on each line, for example Basic: 28000" required>
        {(a) => <Textarea {...a} value={earn} onChange={(x) => setEarn(x.target.value)} />}
      </Field>
      <Field id="pay-d" label="Deductions" hint="One on each line. Leave empty if none.">
        {(a) => <Textarea {...a} value={cut} onChange={(x) => setCut(x.target.value)} />}
      </Field>
      {!e || !c ? (
        <p role="alert" className="text-bad text-sm">
          Write each line as Name: amount, in whole rupees.
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !e?.length || !c}>
        Save salary
      </Button>
    </form>
  );
}

function PayrollBody({ month }: { month: string }) {
  const root = AREA_ROOT[ROLE_AREA[useSession().user?.role ?? "school_owner"]];
  const d = useData<Payroll>(`/payroll?month=${month}`, samplePayroll(month));
  const [editing, setEditing] = useState<PayRow | null>(null);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  if (!d.data.rows.length) return <EmptyState title="No staff yet" />;
  const patch = (id: string, f: (r: PayRow) => PayRow) => (p: Payroll) => ({
    ...p,
    rows: p.rows.map((r) => (r.staffId === id ? f(r) : r)),
  });
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          disabled={d.busy}
          onClick={() =>
            d.send(
              "POST",
              "/payroll",
              { month },
              (p) => ({
                ...p,
                rows: p.rows.map((r) =>
                  r.slip || !r.earnings.length
                    ? r
                    : { ...r, slip: { id: sampleId(), status: "draft", net: r.net } },
                ),
              }),
              "Payslips made",
            )
          }
        >
          Make payslips
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            downloadCsv(`payroll-${month}.csv`, [
              ["Employee no.", "Name", "Net pay", "Status"],
              ...d
                .data!.rows.filter((r) => r.slip)
                .map((r) => [r.employeeNo, r.name, r.slip!.net, r.slip!.status]),
            ])
          }
        >
          Download CSV
        </Button>
      </div>
      <ul className="grid max-w-3xl gap-3">
        {d.data.rows.map((r) => (
          <li key={r.staffId}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-ink font-semibold">{r.name}</p>
                <p className="text-muted text-sm">
                  {r.earnings.length ? `Usual net pay ${rupees(r.net)}` : "Salary not set"}
                  {r.slip ? ` · this month ${rupees(r.slip.net)}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                  Salary
                </Button>
                {r.slip ? (
                  <>
                    <StatusBadge status={r.slip.status} />
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`${root}/print/payslip/${r.slip.id}`}>Payslip</Link>
                    </Button>
                    {r.slip.status === "draft" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={d.busy}
                          onClick={() =>
                            d.send(
                              "PATCH",
                              `/payroll/${r.slip!.id}`,
                              {},
                              patch(r.staffId, (x) => ({
                                ...x,
                                slip: { ...x.slip!, status: "paid" },
                              })),
                              "Marked as paid",
                            )
                          }
                        >
                          Mark paid
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={d.busy}
                          onClick={() =>
                            d.send(
                              "DELETE",
                              `/payroll/${r.slip!.id}`,
                              undefined,
                              patch(r.staffId, (x) => ({ ...x, slip: null })),
                              "Draft removed",
                            )
                          }
                        >
                          Remove draft
                        </Button>
                      </>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {editing ? (
        <Dialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          title={`Salary of ${editing.name}`}
        >
          <SalaryForm
            row={editing}
            busy={d.busy}
            onSave={async (earnings, deductions) => {
              const total = (l: PayLine[]) => l.reduce((s, x) => s + x.rupees, 0);
              const ok = await d.send(
                "PUT",
                "/payroll",
                { staffId: editing.staffId, earnings, deductions },
                patch(editing.staffId, (x) => ({
                  ...x,
                  earnings,
                  deductions,
                  net: total(earnings) - total(deductions),
                })),
                "Salary saved",
              );
              if (ok) setEditing(null);
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}

export function PayrollPage() {
  const [month, setMonth] = useState(todayIso().slice(0, 7));
  return (
    <>
      <PageHeader
        title="Payroll"
        description="Monthly salary and payslips. Amounts are entered by the school; no tax is worked out."
        actions={
          <Input
            type="month"
            aria-label="Month"
            className="max-w-48"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        }
      />
      <PayrollBody key={month} month={month} />
    </>
  );
}

export function MyPayslips() {
  const root = AREA_ROOT[ROLE_AREA[useSession().user?.role ?? "teacher"]];
  const d = useData<{ id: string; month: string; net: number }[]>("/me/payslips", [
    { id: "ps-1", month: "2026-09", net: 33000 },
  ]);
  return (
    <>
      <PageHeader title="My payslips" description="Salary the school has marked as paid." />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={2} />
      ) : !d.data.length ? (
        <EmptyState title="No payslips yet" />
      ) : (
        <ul className="grid max-w-2xl gap-3">
          {d.data.map((s) => (
            <li key={s.id}>
              <Card className="flex items-center justify-between gap-3">
                <span>
                  <span className="text-ink block font-semibold">{s.month}</span>
                  <span className="text-muted text-sm">{rupees(s.net)}</span>
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`${root}/print/payslip/${s.id}`}>View and print</Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
