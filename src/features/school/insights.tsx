"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { downloadCsv } from "../shared/csv";
import { useData } from "../shared/use-data";

interface Report {
  datasets: { key: string; title: string }[];
  columns: string[];
  rows: (string | number)[][];
}

const DATASETS = [
  { key: "students", title: "Students" },
  { key: "staff", title: "Staff" },
  { key: "attendance", title: "Student attendance" },
];
const SAMPLE_ROWS: Record<string, Report> = {
  students: {
    datasets: DATASETS,
    columns: ["Admission no.", "Name", "Class", "Status"],
    rows: [
      ["A-001", "Aarav Mehta", "7 B", "active"],
      ["A-002", "Diya Shah", "7 A", "active"],
    ],
  },
  staff: {
    datasets: DATASETS,
    columns: ["Employee no.", "Name", "Role", "Status"],
    rows: [["EMP-001", "Kavita Iyer", "teacher", "active"]],
  },
  attendance: {
    datasets: DATASETS,
    columns: ["Student", "Class", "Days marked", "Percent"],
    rows: [["Aarav Mehta", "7 B", 40, 92]],
  },
};

function ReportTable({ report, name }: { report: Report; name: string }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const cols = report.columns.map((c, i) => ({ c, i })).filter((x) => !hidden.includes(x.c));
  const needle = q.trim().toLowerCase();
  const rows = report.rows.filter((r) => !needle || r.join(" ").toLowerCase().includes(needle));
  return (
    <>
      <fieldset className="no-print mb-3 flex flex-wrap gap-3">
        <legend className="mb-1 text-sm font-semibold">Columns</legend>
        {report.columns.map((c) => (
          <label key={c} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!hidden.includes(c)}
              onChange={(e) =>
                setHidden(e.target.checked ? hidden.filter((x) => x !== c) : [...hidden, c])
              }
            />
            {c}
          </label>
        ))}
      </fieldset>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Input
          aria-label="Filter rows"
          placeholder="Filter, for example a class or name"
          className="max-w-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          disabled={!rows.length || !cols.length}
          onClick={() =>
            downloadCsv(`${name}.csv`, [
              cols.map((x) => x.c),
              ...rows.map((r) => cols.map((x) => r[x.i])),
            ])
          }
        >
          Download CSV
        </Button>
        <Button variant="ghost" onClick={() => window.print()}>
          Print
        </Button>
      </div>
      <Card className="print-sheet overflow-x-auto">
        <p className="text-muted mb-2 text-sm">
          {rows.length} row(s){rows.length > 200 ? ", first 200 shown; the download has all" : ""}
        </p>
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {cols.map((x) => (
                <th key={x.c} scope="col" className="border-line border-b py-2 pr-4">
                  {x.c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((r, n) => (
              <tr key={n}>
                {cols.map((x) => (
                  <td key={x.c} className="border-line border-b py-2 pr-4">
                    {r[x.i]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}

function ReportData({ dataset }: { dataset: string }) {
  const d = useData<Report>(
    `/reports/builder?dataset=${dataset}`,
    SAMPLE_ROWS[dataset] ?? SAMPLE_ROWS.students!,
  );
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  return <ReportTable report={d.data} name={dataset} />;
}

export function ReportBuilder() {
  const list = useData<Report>("/reports/builder", { datasets: DATASETS, columns: [], rows: [] });
  const [picked, setPicked] = useState("");
  const sets = list.data?.datasets ?? [];
  const dataset = sets.some((s) => s.key === picked) ? picked : (sets[0]?.key ?? "");
  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Report builder"
          description="Choose a list and its columns, then download or print."
        />
      </div>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !dataset ? (
        <LoadingBlock rows={2} />
      ) : (
        <>
          <Select
            aria-label="Report"
            className="no-print mb-4 max-w-sm"
            value={dataset}
            onChange={(e) => setPicked(e.target.value)}
          >
            {sets.map((s) => (
              <option key={s.key} value={s.key}>
                {s.title}
              </option>
            ))}
          </Select>
          <ReportData key={dataset} dataset={dataset} />
        </>
      )}
    </>
  );
}

interface Warning {
  id: string;
  name: string;
  classLabel: string;
  attendancePct: number | null;
  averagePct: number | null;
  reasons: string[];
}

export function EarlyWarning() {
  const d = useData<Warning[]>("/reports/early-warning", [
    {
      id: "c-aarav",
      name: "Aarav Mehta",
      classLabel: "7 B",
      attendancePct: 68,
      averagePct: 52,
      reasons: ["Low attendance"],
    },
  ]);
  return (
    <>
      <PageHeader
        title="Students to check on"
        description="Attendance under 75% in the last 60 days, or an average under 40% in published exams. A reason to talk, not a judgement."
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={3} />
      ) : !d.data.length ? (
        <EmptyState title="Nobody is flagged right now" />
      ) : (
        <ul className="grid max-w-3xl gap-3">
          {d.data.map((w) => (
            <li key={w.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-ink font-semibold">
                    {w.name} · {w.classLabel}
                  </p>
                  <p className="text-muted text-sm">
                    Attendance {w.attendancePct === null ? "–" : `${w.attendancePct}%`} · Average{" "}
                    {w.averagePct === null ? "–" : `${w.averagePct}%`}
                  </p>
                  <p className="text-bad text-sm font-medium">{w.reasons.join(", ")}</p>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/school/students/${w.id}`}>Open student</Link>
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
