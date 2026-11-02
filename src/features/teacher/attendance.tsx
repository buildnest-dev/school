"use client";

import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DevNote, PageHeader, useUnsavedWarning } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { cn } from "@/lib/utils";
import type { AttendanceMark, AttendanceSheet } from "@/types";
import { todayLabel } from "../shared/format";
import type { ScreenProps } from "../shared/planned-screen";

/** Step 1: choose a class. */
export function AttendancePick() {
  const s = useServices();
  const date = todayIso();
  const data = useAsync(async () => {
    const classes = await s.teacher.classes();
    const sheets = await Promise.all(classes.map((c) => s.attendance.getSheet(c.id, date)));
    return classes.map((c, i) => ({ ...c, status: sheets[i]?.status ?? "draft" }));
  }, [s]);

  return (
    <>
      <PageHeader title="Mark Attendance" description={`Choose a class for ${todayLabel(date)}.`} />
      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingBlock />
      ) : data.data.length === 0 ? (
        <EmptyState title="No classes today" hint="Your timetable has no classes for today." />
      ) : (
        <ul className="grid gap-3">
          {data.data.map((c) => (
            <li key={c.id}>
              <Card className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">
                    {c.label} · {c.subject}
                  </p>
                  <p className="text-muted text-sm">
                    {c.period} · {c.time} · {c.studentCount} students
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={c.status === "submitted" ? "submitted" : "pending"} />
                  <Button asChild>
                    <Link href={`/teacher/attendance/${c.id}`}>
                      {c.status === "submitted" ? "View" : "Mark Attendance"}
                    </Link>
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

const OPTIONS: { value: AttendanceMark; label: string; on: string }[] = [
  { value: "present", label: "Present", on: "border-ok bg-[#e3f1ea] text-[#1d5a41]" },
  { value: "absent", label: "Absent", on: "border-bad bg-[#f6dede] text-[#8a2b2b]" },
  { value: "late", label: "Late", on: "border-warn bg-[#f8ebd2] text-[#7d4a08]" },
];

/** Step 2: mark who is here. Everyone starts as present; change only the exceptions. */
export function AttendanceClass({ params }: ScreenProps) {
  const classId = params.classId ?? "";
  const s = useServices();
  const date = todayIso();
  const sheet = useAsync(() => s.attendance.getSheet(classId, date), [s, classId]);
  if (sheet.error) return <ErrorState message={sheet.error.message} onRetry={sheet.reload} />;
  if (sheet.loading && !sheet.data) return <LoadingBlock />;
  if (!sheet.data)
    return (
      <EmptyState
        title="Class not found"
        hint="This class isn’t on your timetable."
        action={
          <Button asChild variant="ghost">
            <Link href="/teacher/attendance">Back to classes</Link>
          </Button>
        }
      />
    );
  // Keyed by class: the editor's state is initialised from the loaded sheet, never synced by an effect.
  return <AttendanceEditor key={classId} data={sheet.data} />;
}

function AttendanceEditor({ data }: { data: AttendanceSheet }) {
  const classId = data.classId;
  const date = data.date;
  const sheet = { data };
  const s = useServices();
  const router = useRouter();
  const { toast } = useToast();
  const [marks, setMarks] = useState<Record<string, AttendanceMark>>(() =>
    Object.fromEntries(data.roster.map((r) => [r.id, data.marks[r.id] ?? "present"])),
  );
  const [dirty, setDirty] = useState(false);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittedNow, setSubmittedNow] = useState(false);
  useUnsavedWarning(dirty);

  const submitted = data.status === "submitted" || submittedNow;
  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, late: 0 };
    for (const v of Object.values(marks)) c[v] += 1;
    return c;
  }, [marks]);

  const roster = sheet.data.roster.filter((r) =>
    r.name.toLowerCase().includes(q.trim().toLowerCase()),
  );
  const set = (id: string, v: AttendanceMark) => {
    setMarks((m) => ({ ...m, [id]: v }));
    setDirty(true);
  };
  const persist = async (submit: boolean) => {
    setBusy(true);
    try {
      const res = await s.attendance.save(classId, date, marks, submit);
      setDirty(false);
      if (submit) setSubmittedNow(true);
      toast({
        title: submit ? `Attendance recorded for ${sheet.data?.classLabel}` : "Draft kept",
        description: res.message,
        tone: "success",
      });
      if (submit) setConfirm(false);
    } catch (e) {
      toast({
        title: "Couldn’t save",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const back = () => (dirty ? setLeave(true) : router.push("/teacher/attendance"));

  return (
    <>
      <button
        type="button"
        onClick={back}
        className="text-muted hover:text-ink mb-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> All classes
      </button>
      <PageHeader
        eyebrow={todayLabel(date)}
        title={`Attendance · ${sheet.data.classLabel}`}
        actions={<StatusBadge status={submitted ? "submitted" : "draft"} />}
      />

      {submitted ? (
        <div
          role="status"
          className="border-ok/50 mb-4 rounded-lg border bg-[#e3f1ea] p-4 text-[#1d5a41]"
        >
          <p className="font-semibold">Attendance has been recorded.</p>
          <p className="text-sm">
            To correct it later, ask the office. (Correction requests with approval are part of the
            backend scope.)
          </p>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-3 gap-3 text-center" aria-live="polite">
        {[
          ["Present", counts.present],
          ["Absent", counts.absent],
          ["Late", counts.late],
        ].map(([l, n]) => (
          <div key={l} className="border-line bg-surface rounded-lg border p-3">
            <p className="font-display text-3xl tabular-nums">{n}</p>
            <p className="text-muted text-sm">{l}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <label htmlFor="roster-search" className="sr-only">
            Search students
          </label>
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            id="roster-search"
            type="search"
            placeholder="Search students"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {!submitted ? (
          <Button
            variant="ghost"
            onClick={() => {
              setMarks(
                Object.fromEntries(sheet.data!.roster.map((r) => [r.id, "present" as const])),
              );
              setDirty(true);
            }}
          >
            Mark all present
          </Button>
        ) : null}
      </div>

      {roster.length === 0 ? (
        <EmptyState title="No students match" hint="Clear the search to see everyone." />
      ) : (
        <ul className="border-line bg-surface divide-line grid divide-y rounded-lg border">
          {roster.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <span className="text-base font-semibold">
                <span className="text-muted mr-2 text-sm tabular-nums">{r.rollNo}</span>
                {r.name}
              </span>
              <div
                role="radiogroup"
                aria-label={`Attendance for ${r.name}`}
                className="flex gap-1.5"
              >
                {OPTIONS.map((o) => {
                  const on = marks[r.id] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={submitted}
                      onClick={() => set(r.id, o.value)}
                      className={cn(
                        "min-h-11 min-w-[4.5rem] rounded-md border-2 px-3 text-sm font-semibold transition-colors disabled:cursor-default",
                        on
                          ? o.on
                          : "border-line text-muted hover:border-ink hover:text-ink bg-white",
                      )}
                    >
                      {on ? "✓ " : ""}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!submitted ? (
        <div className="border-line bg-paper sticky bottom-16 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 border-t py-3 lg:bottom-0">
          <p className="text-muted text-sm" aria-live="polite">
            {dirty ? "You have unsaved changes." : "No changes yet."}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={busy || !dirty} onClick={() => persist(false)}>
              Save draft
            </Button>
            <Button disabled={busy} onClick={() => setConfirm(true)} className="min-h-12 px-6">
              Submit attendance
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-4">
        <DevNote>
          Saving here updates the development mock only. Parents are not notified and nothing is
          stored on a server.
        </DevNote>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Submit attendance for ${sheet.data.classLabel}?`}
        description={`${counts.present} present, ${counts.absent} absent, ${counts.late} late. Once submitted, changes need the office.`}
        confirmLabel="Yes, submit"
        busy={busy}
        onConfirm={() => persist(true)}
      />
      <ConfirmDialog
        open={leave}
        onOpenChange={setLeave}
        title="Leave without saving?"
        description="You have changes that haven’t been saved. If you leave now, they will be lost."
        confirmLabel="Leave without saving"
        cancelLabel="Keep marking"
        onConfirm={() => router.push("/teacher/attendance")}
      />
    </>
  );
}
