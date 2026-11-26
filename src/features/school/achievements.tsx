"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { todayIso } from "@/config/env";
import { fmtDate, prettyKey } from "../shared/format";
import { sampleId, useData } from "../shared/use-data";

interface Board {
  students: { id: string; name: string; classLabel: string }[];
  items: {
    id: string;
    student: string;
    title: string;
    category: string;
    awardedOn: string;
    note: string;
  }[];
}

const SAMPLE: Board = {
  students: [
    { id: "c-aarav", name: "Aarav Mehta", classLabel: "7B" },
    { id: "c-diya", name: "Diya Rao", classLabel: "8A" },
  ],
  items: [
    {
      id: "a1",
      student: "Aarav Mehta · 7B",
      title: "First prize, inter-house debate",
      category: "academic",
      awardedOn: "2026-09-18",
      note: "Spoke for Blue House.",
    },
  ],
};

const CATEGORIES = ["academic", "sports", "arts", "service", "other"];

/** Staff record prizes and recognition; the student and parent see them. */
export function StaffAchievements() {
  const d = useData<Board>("/achievements", SAMPLE);
  const [f, setF] = useState({
    studentId: "",
    title: "",
    category: "academic",
    awardedOn: todayIso(),
    note: "",
  });
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const student = d.data.students.find((s) => s.id === f.studentId) ?? d.data.students[0];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!student) return;
    const body = { ...f, studentId: student.id };
    const ok = await d.send(
      "POST",
      "/achievements",
      body,
      (b) => ({
        ...b,
        items: [
          { id: sampleId(), student: `${student.name} · ${student.classLabel}`, ...f },
          ...b.items,
        ],
      }),
      "Added",
    );
    if (ok) setF({ ...f, title: "", note: "" });
  };
  return (
    <>
      <PageHeader title="Achievements" description="Record prizes and recognition for students." />
      <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Add an achievement" />
          {!student ? (
            <p className="text-muted text-sm">There are no students to choose from yet.</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <Field id="student" label="Student" required>
                {(a) => (
                  <Select
                    {...a}
                    value={student.id}
                    onChange={(e) => setF({ ...f, studentId: e.target.value })}
                  >
                    {d.data!.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.classLabel}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="title" label="Achievement" required>
                {(a) => (
                  <Input
                    {...a}
                    value={f.title}
                    onChange={(e) => setF({ ...f, title: e.target.value })}
                  />
                )}
              </Field>
              <Field id="category" label="Category">
                {(a) => (
                  <Select
                    {...a}
                    value={f.category}
                    onChange={(e) => setF({ ...f, category: e.target.value })}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {prettyKey(c)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="awardedOn" label="Date" required>
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={f.awardedOn}
                    onChange={(e) => setF({ ...f, awardedOn: e.target.value })}
                  />
                )}
              </Field>
              <Field id="note" label="Note">
                {(a) => (
                  <Textarea
                    {...a}
                    value={f.note}
                    onChange={(e) => setF({ ...f, note: e.target.value })}
                  />
                )}
              </Field>
              <Button type="submit" disabled={d.busy || f.title.trim().length < 3}>
                Add
              </Button>
            </form>
          )}
        </Card>
        {!d.data.items.length ? (
          <EmptyState title="No achievements yet" />
        ) : (
          <ul className="grid gap-3">
            {d.data.items.map((x) => (
              <li key={x.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-ink font-semibold">{x.title}</p>
                      <p className="text-muted text-sm">
                        {x.student} · {prettyKey(x.category)} · {fmtDate(x.awardedOn)}
                      </p>
                      {x.note ? <p className="mt-2 text-sm">{x.note}</p> : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={d.busy}
                      onClick={() =>
                        d.send(
                          "DELETE",
                          `/achievements/${x.id}`,
                          undefined,
                          (b) => ({ ...b, items: b.items.filter((i) => i.id !== x.id) }),
                          "Removed",
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
