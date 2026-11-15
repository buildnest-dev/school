"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

interface Row {
  sectionId: string;
  subjectId: string;
  classLabel: string;
  subject: string;
  pct: number;
}

/** The teacher reports how much of each subject they have covered in each class. */
export function LiveSyllabus() {
  const { toast } = useToast();
  const d = useAsync(() => apiRequest<Row[]>("/teacher/syllabus-progress"), []);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const save = async (r: Row) => {
    const key = `${r.sectionId}|${r.subjectId}`;
    const pct = Number(edit[key]);
    if (!Number.isInteger(pct) || pct < 0 || pct > 100) {
      toast({ title: "Enter a number from 0 to 100", tone: "error" });
      return;
    }
    setBusy(key);
    try {
      await apiRequest("/teacher/syllabus-progress", {
        method: "PUT",
        body: { sectionId: r.sectionId, subjectId: r.subjectId, pct },
      });
      toast({ title: "Saved", description: `${r.classLabel} · ${r.subject}: ${pct}%` });
      setEdit((e) => {
        const n = { ...e };
        delete n[key];
        return n;
      });
      d.reload();
    } catch (err) {
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Syllabus progress"
        description="Tell the school how much of each subject you have covered in each class."
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={2} />
      ) : d.data.length === 0 ? (
        <EmptyState
          title="No classes yet"
          hint="Classes you teach in the timetable appear here."
        />
      ) : (
        <Card className="max-w-2xl">
          <ul className="grid gap-4">
            {d.data.map((r) => {
              const key = `${r.sectionId}|${r.subjectId}`;
              const shown = edit[key] ?? String(r.pct);
              return (
                <li key={key} className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span>
                      <span className="font-medium">{r.classLabel}</span>
                      <span className="text-muted"> · {r.subject}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={`sy-${key}`}>
                        Percent covered for {r.classLabel} {r.subject}
                      </label>
                      <Input
                        id={`sy-${key}`}
                        className="w-20"
                        inputMode="numeric"
                        value={shown}
                        onChange={(e) => setEdit((s) => ({ ...s, [key]: e.target.value }))}
                      />
                      <span className="text-muted">%</span>
                      <Button
                        variant="ghost"
                        onClick={() => save(r)}
                        disabled={busy === key || edit[key] === undefined}
                      >
                        Save
                      </Button>
                    </span>
                  </div>
                  <span className="bg-paper-2 block h-2 overflow-hidden rounded-full">
                    <span
                      className="bg-ink-2 block h-full rounded-full"
                      style={{ width: `${Math.min(100, r.pct)}%` }}
                    />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
