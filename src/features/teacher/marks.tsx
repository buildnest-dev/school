"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { DevNote, PageHeader, useUnsavedWarning } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import type { MarksSheet } from "@/types";
import { useServices } from "@/hooks/use-services";
import { cn } from "@/lib/utils";
import type { ScreenProps } from "../shared/planned-screen";
import { validateMark } from "./schemas";

export function MarksPick() {
  const s = useServices();
  const data = useAsync(async () => {
    const classes = await s.teacher.classes();
    const sheets = await Promise.all(classes.map((c) => s.marks.getSheet(c.id)));
    return classes.map((c, i) => ({ ...c, sheet: sheets[i] }));
  }, [s]);
  return (
    <>
      <PageHeader title="Enter Marks" description="Choose a class to enter Unit Test 2 marks." />
      {data.error ? (
        <ErrorState message={data.error.message} onRetry={data.reload} />
      ) : !data.data ? (
        <LoadingBlock />
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
                    Unit Test 2 · out of {c.sheet?.maxMarks ?? 50}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={c.sheet?.status ?? "draft"} />
                  <Button asChild>
                    <Link href={`/teacher/marks/${c.id}`}>
                      {c.sheet?.status === "submitted" ? "View" : "Enter Marks"}
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

export function MarksClass({ params }: ScreenProps) {
  const classId = params.classId ?? "";
  const s = useServices();
  const sheet = useAsync(() => s.marks.getSheet(classId), [s, classId]);
  if (sheet.error) return <ErrorState message={sheet.error.message} onRetry={sheet.reload} />;
  if (sheet.loading && !sheet.data) return <LoadingBlock />;
  if (!sheet.data)
    return (
      <EmptyState
        title="Class not found"
        action={
          <Button asChild variant="ghost">
            <Link href="/teacher/marks">Back to classes</Link>
          </Button>
        }
      />
    );
  // Keyed by class: editor state is initialised from the loaded sheet instead of synced by an effect.
  return <MarksEditor key={classId} data={sheet.data} />;
}

function MarksEditor({ data }: { data: MarksSheet }) {
  const classId = data.classId;
  const sheet = { data };
  const s = useServices();
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      data.roster.map((r) => [r.id, data.marks[r.id] == null ? "" : String(data.marks[r.id])]),
    ),
  );
  const [dirty, setDirty] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [leave, setLeave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submittedNow, setSubmittedNow] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  useUnsavedWarning(dirty);

  const max = data.maxMarks;
  const errors = useMemo(
    () => Object.fromEntries(Object.entries(values).map(([id, v]) => [id, validateMark(v, max)])),
    [values, max],
  );
  const invalid = Object.values(errors).filter(Boolean).length;
  const missing = Object.values(values).filter((v) => v.trim() === "").length;
  const submitted = data.status === "submitted" || submittedNow;

  const toNumbers = () =>
    Object.fromEntries(
      Object.entries(values).map(([id, v]) => [id, v.trim() === "" ? null : Number(v)]),
    );
  const persist = async (submit: boolean) => {
    setBusy(true);
    try {
      const res = await s.marks.save(classId, toNumbers(), submit);
      setDirty(false);
      if (submit) {
        setSubmittedNow(true);
        setConfirm(false);
      }
      toast({ title: submit ? "Marks submitted" : "Draft kept", description: res.message });
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
  const trySubmit = () => {
    setShowErrors(true);
    if (invalid > 0 || missing > 0) {
      toast({
        title: "Please fix the marks first",
        description: invalid
          ? `${invalid} mark${invalid > 1 ? "s" : ""} need correcting.`
          : `${missing} student${missing > 1 ? "s have" : " has"} no mark yet.`,
        tone: "error",
      });
      document.querySelector<HTMLElement>("[data-invalid='true'], [data-empty='true']")?.focus();
      return;
    }
    setConfirm(true);
  };
  const back = () => (dirty ? setLeave(true) : router.push("/teacher/marks"));

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
        title={`Marks · ${sheet.data.classLabel}`}
        description={`${sheet.data.subject} · ${sheet.data.assessment} · out of ${max}`}
        actions={<StatusBadge status={submitted ? "submitted" : "draft"} />}
      />

      {submitted ? (
        <div
          role="status"
          className="border-ok/50 mb-4 rounded-lg border bg-[#e3f1ea] p-4 font-semibold text-[#1d5a41]"
        >
          Marks have been submitted for review.
        </div>
      ) : null}

      <ul className="border-line bg-surface divide-line grid divide-y rounded-lg border">
        {sheet.data.roster.map((r) => {
          const err = errors[r.id];
          const empty = (values[r.id] ?? "").trim() === "";
          const id = `mark-${r.id}`;
          return (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <label htmlFor={id} className="text-base font-semibold">
                <span className="text-muted mr-2 text-sm tabular-nums">{r.rollNo}</span>
                {r.name}
              </label>
              <div className="text-right">
                <div className="flex items-center gap-2">
                  <input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={submitted}
                    value={values[r.id] ?? ""}
                    data-invalid={err ? "true" : undefined}
                    data-empty={showErrors && empty ? "true" : undefined}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? `${id}-err` : undefined}
                    onChange={(e) => {
                      setValues((v) => ({ ...v, [r.id]: e.target.value }));
                      setDirty(true);
                    }}
                    className={cn(
                      "min-h-11 w-24 rounded-md border bg-white px-3 text-right text-base tabular-nums",
                      err ? "border-bad" : showErrors && empty ? "border-warn" : "border-[#bdb5a4]",
                      "disabled:bg-paper-2",
                    )}
                  />
                  <span className="text-muted text-sm">/ {max}</span>
                </div>
                {err ? (
                  <p id={`${id}-err`} role="alert" className="text-bad mt-1 text-xs font-medium">
                    {err}
                  </p>
                ) : showErrors && empty ? (
                  <p className="mt-1 text-xs font-medium text-[#7d4a08]">Needs a mark</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {!submitted ? (
        <div className="border-line bg-paper sticky bottom-16 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 border-t py-3 lg:bottom-0">
          <p className="text-muted text-sm" aria-live="polite">
            {missing} still to enter{dirty ? " · unsaved changes" : ""}
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              disabled={busy || !dirty || invalid > 0}
              onClick={() => persist(false)}
            >
              Save draft
            </Button>
            <Button disabled={busy} onClick={trySubmit} className="min-h-12 px-6">
              Submit marks
            </Button>
          </div>
        </div>
      ) : null}
      <div className="mt-4">
        <DevNote>
          Saving here updates the development mock only. Nothing is stored on a server and no one
          reviews it.
        </DevNote>
      </div>

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit these marks?"
        description={`All ${sheet.data.roster.length} students have a mark. After submitting, the marks go for review and can’t be edited here.`}
        confirmLabel="Yes, submit"
        busy={busy}
        onConfirm={() => persist(true)}
      />
      <ConfirmDialog
        open={leave}
        onOpenChange={setLeave}
        title="Leave without saving?"
        description="You have marks that haven’t been saved. If you leave now, they will be lost."
        confirmLabel="Leave without saving"
        cancelLabel="Keep entering"
        onConfirm={() => router.push("/teacher/marks")}
      />
    </>
  );
}
