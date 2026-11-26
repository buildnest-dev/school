"use client";

import { BarList, PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { Select } from "@/components/ui/field";
import { useAsync } from "@/hooks/use-async";
import { useSession } from "@/hooks/use-session";
import { useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { fmtDate } from "../shared/format";
import { ApiAction, QuickAdd } from "../shared/quick-add";

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
  const role = useSession().user?.role;
  const manages = role === "school_owner" || role === "principal" || role === "vice_principal";
  return (
    <>
      <PageHeader
        title="Results overview"
        description="Publication status, averages and the spread of marks, from the marks entered."
        actions={
          manages ? (
            <QuickAdd
              label="New exam"
              title="Create an exam"
              description="Teachers can then enter marks for it."
              endpoint="/exams"
              fields={[
                { key: "name", label: "Exam name", placeholder: "Half yearly" },
                { key: "maxMarks", label: "Full marks", type: "number" },
                { key: "passPercent", label: "Pass percentage", type: "number" },
              ]}
              values={{ maxMarks: "100", passPercent: "33" }}
              onCreated={d.reload}
            />
          ) : null
        }
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
                  {manages ? (
                    <div className="flex flex-wrap gap-2">
                      {x.published ? null : (
                        <ApiAction
                          label={x.approved ? "Remove approval" : "Approve marks"}
                          method="POST"
                          endpoint={`/exams/${x.id}/approve`}
                          body={{ approved: !x.approved }}
                          onDone={d.reload}
                        />
                      )}
                      {x.approved || x.published ? (
                        <ApiAction
                          label={x.published ? "Hide results" : "Publish results"}
                          method="POST"
                          endpoint={`/exams/${x.id}/publish`}
                          body={{ published: !x.published }}
                          onDone={d.reload}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader
              title={
                d.data.spreadExam ? `Spread of marks · ${d.data.spreadExam}` : "Spread of marks"
              }
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
      {d.data?.exams.length ? <ClassSheet exams={d.data.exams} /> : null}
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

interface Sheet {
  summary: { students: number; complete: number; passed: number; averagePercent: number | null };
  rows: {
    studentId: string;
    rollNo: number;
    name: string;
    total: number | null;
    maxTotal: number | null;
    percent: number | null;
    grade: string | null;
    result: string;
    rank: number | null;
  }[];
}

/** Every student of one class in one exam: total, percentage, grade, result and rank. */
function ClassSheet({ exams }: { exams: { id: string; name: string }[] }) {
  const classes = useAsync(
    () => apiRequest<{ name: string; sections: { id: string; name: string }[] }[]>("/classes"),
    [],
  );
  const [exam, setExam] = useState("");
  const [section, setSection] = useState("");
  const examId = exam || exams[0]?.id || "";
  const sheet = useAsync(
    () =>
      section && examId
        ? apiRequest<Sheet>(`/report-cards/classes/${section}`, { query: { examId } })
        : Promise.resolve(undefined),
    [section, examId],
  );
  return (
    <Card className="mt-5 grid gap-3">
      <CardHeader title="Class result sheet" />
      <div className="flex flex-wrap gap-3">
        <Select
          aria-label="Exam"
          className="max-w-xs"
          value={examId}
          onChange={(e) => setExam(e.target.value)}
        >
          {exams.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Class for the result sheet"
          className="max-w-xs"
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="">Choose a class</option>
          {classes.data?.flatMap((c) =>
            c.sections.map((s) => (
              <option key={s.id} value={s.id}>
                {c.name} · {s.name}
              </option>
            )),
          )}
        </Select>
      </div>
      {sheet.error ? (
        <ErrorState message={sheet.error.message} onRetry={sheet.reload} />
      ) : sheet.data ? (
        <div className="overflow-x-auto">
          <p className="text-muted mb-2 text-sm">
            {sheet.data.summary.complete} of {sheet.data.summary.students} complete ·{" "}
            {sheet.data.summary.passed} passed
          </p>
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Class result sheet</caption>
            <thead>
              <tr className="border-line border-b">
                {["Roll", "Student", "Total", "%", "Grade", "Result", "Rank"].map((h) => (
                  <th key={h} scope="col" className="px-2 py-2">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.data.rows.map((r) => (
                <tr key={r.studentId} className="border-line border-b last:border-0">
                  <td className="px-2 py-1.5">{r.rollNo}</td>
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5">
                    {r.total === null ? "-" : `${r.total}/${r.maxTotal}`}
                  </td>
                  <td className="px-2 py-1.5">{r.percent ?? "-"}</td>
                  <td className="px-2 py-1.5">{r.grade ?? "-"}</td>
                  <td className="px-2 py-1.5">{r.result}</td>
                  <td className="px-2 py-1.5">{r.rank ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Card>
  );
}
