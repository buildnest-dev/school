"use client";

import { BarList, PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import { fmtDate } from "../shared/format";

interface ResultsData {
  exams: {
    id: string;
    name: string;
    published: boolean;
    approved: boolean;
    entries: number;
    avgPct: number;
    passPct: number;
  }[];
  spreadExam: string | null;
  spread: { label: string; count: number; pct: number }[];
}

/** Every exam with its state, average and pass rate, and how the latest published exam is spread. */
export function LiveResults() {
  const d = useAsync(() => apiRequest<ResultsData>("/results/overview"), []);
  return (
    <>
      <PageHeader
        title="Results overview"
        description="Publication status, averages and the spread of marks, from the marks entered."
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock />
      ) : d.data.exams.length === 0 ? (
        <EmptyState
          title="No exams yet"
          hint="Once teachers enter marks for an exam, it appears here."
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Exams" />
            <ul className="grid gap-3 text-sm">
              {d.data.exams.map((x) => (
                <li key={x.id} className="grid gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{x.name}</span>
                    <StatusBadge status={x.published ? "published" : "draft"} />
                  </div>
                  <span className="text-muted">
                    {x.entries} marks entered · average {x.avgPct}% · pass rate {x.passPct}%
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader
              title={d.data.spreadExam ? `Spread of marks · ${d.data.spreadExam}` : "Spread of marks"}
            />
            {d.data.spread.length ? (
              <BarList
                rows={d.data.spread.map((r) => ({
                  label: r.label,
                  pct: r.pct,
                  text: `${r.count}`,
                }))}
              />
            ) : (
              <p className="text-muted text-sm">Shown once an exam is published.</p>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

interface ReportData {
  enrolment: { label: string; count: number }[];
  attendance: { label: string; pct: number }[];
  fees: { label: string; pct: number }[];
  workload: { label: string; pct: number; count: number }[];
}

/** The standard reports, from live records. */
export function LiveReports() {
  const d = useAsync(() => apiRequest<ReportData>("/reports/summary"), []);
  const top = Math.max(1, ...(d.data?.enrolment.map((e) => e.count) ?? [1]));
  const block = (title: string, hint: string, body: React.ReactNode) => (
    <Card>
      <CardHeader title={title} hint={hint} />
      {body}
    </Card>
  );
  return (
    <>
      <PageHeader
        title="Reports"
        description="The standard reports, built from your school’s records."
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {block(
            "Students by class",
            "Active students",
            d.data.enrolment.length ? (
              <BarList
                rows={d.data.enrolment.map((e) => ({
                  label: e.label,
                  pct: Math.round((e.count / top) * 100),
                  text: String(e.count),
                }))}
              />
            ) : (
              <p className="text-muted text-sm">No students yet.</p>
            ),
          )}
          {block(
            "Attendance, last school days",
            "Present or late",
            d.data.attendance.length ? (
              <BarList
                rows={d.data.attendance.map((a) => ({ label: fmtDate(a.label), pct: a.pct }))}
              />
            ) : (
              <p className="text-muted text-sm">No attendance marked yet.</p>
            ),
          )}
          {block(
            "Fees collected",
            "Paid against billed",
            d.data.fees.length ? (
              <BarList rows={d.data.fees} />
            ) : (
              <p className="text-muted text-sm">No fees raised yet.</p>
            ),
          )}
          {block(
            "Teacher workload",
            "Periods per week",
            d.data.workload.length ? (
              <BarList
                rows={d.data.workload.map((w) => ({
                  label: w.label,
                  pct: w.pct,
                  text: String(w.count),
                }))}
              />
            ) : (
              <p className="text-muted text-sm">No timetable yet.</p>
            ),
          )}
        </div>
      )}
    </>
  );
}
