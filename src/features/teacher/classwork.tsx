"use client";

import { ExternalLink } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { todayIso } from "@/config/env";
import { Files } from "../shared/files";
import { fmtDate, fmtDateTime } from "../shared/format";
import { sampleId, useData } from "../shared/use-data";

interface Pair {
  sectionId: string;
  subjectId: string;
  classLabel: string;
  subject: string;
}

const PAIRS: Pair[] = [
  { sectionId: "6a", subjectId: "eng", classLabel: "6A", subject: "English" },
  { sectionId: "8a", subjectId: "eng", classLabel: "8A", subject: "English" },
  { sectionId: "9b", subjectId: "eng", classLabel: "9B", subject: "English" },
];

const keyOf = (p: Pair) => `${p.sectionId}|${p.subjectId}`;

/** "Class and subject" choice, filled from the teacher's own classes. */
function ClassPicker({
  pairs,
  value,
  onChange,
}: {
  pairs: Pair[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field id="pair" label="Class and subject" required>
      {(a) => (
        <Select {...a} value={value} onChange={(e) => onChange(e.target.value)}>
          {pairs.map((p) => (
            <option key={keyOf(p)} value={keyOf(p)}>
              {p.classLabel} · {p.subject}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

function usePairs() {
  const d = useData<Pair[]>("/teacher/class-subjects", PAIRS);
  const [picked, setPicked] = useState("");
  const pairs = d.data ?? [];
  const pair = pairs.find((p) => keyOf(p) === picked) ?? pairs[0];
  return { pairs, pair, value: pair ? keyOf(pair) : "", setPicked, loading: d.loading };
}

export interface Material {
  id: string;
  title: string;
  description: string;
  link: string;
  author: string;
  sharedOn: string;
  classLabel: string;
  subject: string;
}

export const SAMPLE_MATERIALS: Material[] = [
  {
    id: "m1",
    title: "Tenses worksheet",
    description: "Ten practice sentences. Bring the completed sheet on Friday.",
    link: "https://example.com/tenses.pdf",
    author: "Kavita Iyer",
    sharedOn: "2026-10-22",
    classLabel: "8A",
    subject: "English",
  },
];

export function MaterialList({
  items,
  onRemove,
}: {
  items: Material[];
  /** Given to the teacher: allows removing the item and adding files to it. */
  onRemove?: (id: string) => void;
}) {
  const [shown, setShown] = useState<Record<string, boolean>>({});
  if (!items.length)
    return (
      <EmptyState title="No study material yet" hint="Shared notes and worksheets appear here." />
    );
  return (
    <ul className="grid gap-3">
      {items.map((m) => (
        <li key={m.id}>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink font-semibold">{m.title}</p>
                <p className="text-muted text-sm">
                  {m.classLabel} · {m.subject} · {m.author} · {fmtDate(m.sharedOn)}
                </p>
                {m.description ? <p className="mt-2 text-sm">{m.description}</p> : null}
              </div>
              <div className="flex gap-2">
                {m.link ? (
                  <Button asChild variant="ghost" size="sm">
                    <a href={m.link} target="_blank" rel="noopener noreferrer">
                      Open <ExternalLink className="size-4" aria-hidden="true" />
                    </a>
                  </Button>
                ) : null}
                {onRemove ? (
                  <Button variant="ghost" size="sm" onClick={() => onRemove(m.id)}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <details
              className="mt-3 text-sm"
              onToggle={(e) => e.currentTarget.open && setShown((s) => ({ ...s, [m.id]: true }))}
            >
              <summary className="cursor-pointer font-semibold">Files</summary>
              <div className="mt-2">
                {shown[m.id] ? (
                  <Files entity="material" entityId={m.id} canAdd={!!onRemove} />
                ) : null}
              </div>
            </details>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function TeacherMaterials() {
  const d = useData<Material[]>("/materials", SAMPLE_MATERIALS);
  const c = usePairs();
  const [f, setF] = useState({ title: "", description: "", link: "" });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = c.pair;
    if (!p) return;
    const ok = await d.send(
      "POST",
      "/materials",
      { sectionId: p.sectionId, subjectId: p.subjectId, ...f },
      (list) => [
        {
          id: sampleId(),
          ...f,
          author: "You",
          sharedOn: todayIso(),
          classLabel: p.classLabel,
          subject: p.subject,
        },
        ...list,
      ],
      "Shared with the class",
    );
    if (ok) setF({ title: "", description: "", link: "" });
  };
  return (
    <>
      <PageHeader title="Study material" description="Share notes and worksheets with a class." />
      <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Share something" />
          {!c.loading && !c.pairs.length ? (
            <p className="text-muted text-sm">
              Your classes appear here once the school adds you to the timetable.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <ClassPicker pairs={c.pairs} value={c.value} onChange={c.setPicked} />
              <Field id="title" label="Title" required>
                {(a) => (
                  <Input
                    {...a}
                    value={f.title}
                    onChange={(e) => setF({ ...f, title: e.target.value })}
                  />
                )}
              </Field>
              <Field id="link" label="Link" hint="A https:// link to the file or page (optional).">
                {(a) => (
                  <Input
                    {...a}
                    type="url"
                    value={f.link}
                    onChange={(e) => setF({ ...f, link: e.target.value })}
                  />
                )}
              </Field>
              <Field id="description" label="Note">
                {(a) => (
                  <Textarea
                    {...a}
                    value={f.description}
                    onChange={(e) => setF({ ...f, description: e.target.value })}
                  />
                )}
              </Field>
              <Button type="submit" disabled={d.busy || f.title.trim().length < 3}>
                Share
              </Button>
            </form>
          )}
        </Card>
        {d.error ? (
          <ErrorState message={d.error.message} onRetry={d.reload} />
        ) : !d.data ? (
          <LoadingBlock rows={3} />
        ) : (
          <MaterialList
            items={d.data}
            onRemove={(id) =>
              d.send(
                "DELETE",
                `/materials/${id}`,
                undefined,
                (l) => l.filter((x) => x.id !== id),
                "Removed",
              )
            }
          />
        )}
      </div>
    </>
  );
}

interface Lesson {
  id: string;
  title: string;
  objectives: string;
  plannedOn: string;
  status: "planned" | "taught";
  classLabel: string;
  subject: string;
}

const SAMPLE_LESSONS: Lesson[] = [
  {
    id: "l1",
    title: "Reported speech",
    objectives: "Convert direct to reported speech in past tense.",
    plannedOn: "2026-10-27",
    status: "planned",
    classLabel: "8A",
    subject: "English",
  },
];

export function TeacherLessons() {
  const d = useData<Lesson[]>("/teacher/lessons", SAMPLE_LESSONS);
  const c = usePairs();
  const [f, setF] = useState({ title: "", objectives: "", plannedOn: todayIso() });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const p = c.pair;
    if (!p) return;
    const ok = await d.send(
      "POST",
      "/teacher/lessons",
      { sectionId: p.sectionId, subjectId: p.subjectId, ...f },
      (list) => [
        { id: sampleId(), ...f, status: "planned", classLabel: p.classLabel, subject: p.subject },
        ...list,
      ],
      "Lesson planned",
    );
    if (ok) setF({ ...f, title: "", objectives: "" });
  };
  return (
    <>
      <PageHeader title="Lesson plans" description="Plan lessons and mark them taught." />
      <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="Plan a lesson" />
          {!c.loading && !c.pairs.length ? (
            <p className="text-muted text-sm">
              Your classes appear here once the school adds you to the timetable.
            </p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <ClassPicker pairs={c.pairs} value={c.value} onChange={c.setPicked} />
              <Field id="title" label="Topic" required>
                {(a) => (
                  <Input
                    {...a}
                    value={f.title}
                    onChange={(e) => setF({ ...f, title: e.target.value })}
                  />
                )}
              </Field>
              <Field id="plannedOn" label="Date" required>
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={f.plannedOn}
                    onChange={(e) => setF({ ...f, plannedOn: e.target.value })}
                  />
                )}
              </Field>
              <Field id="objectives" label="What students will learn">
                {(a) => (
                  <Textarea
                    {...a}
                    value={f.objectives}
                    onChange={(e) => setF({ ...f, objectives: e.target.value })}
                  />
                )}
              </Field>
              <Button type="submit" disabled={d.busy || f.title.trim().length < 3 || !f.plannedOn}>
                Save plan
              </Button>
            </form>
          )}
        </Card>
        {d.error ? (
          <ErrorState message={d.error.message} onRetry={d.reload} />
        ) : !d.data ? (
          <LoadingBlock rows={3} />
        ) : !d.data.length ? (
          <EmptyState title="No lesson plans yet" hint="Plan your first lesson on the left." />
        ) : (
          <ul className="grid gap-3">
            {d.data.map((l) => {
              const next = l.status === "taught" ? "planned" : "taught";
              return (
                <li key={l.id}>
                  <Card>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-ink font-semibold">{l.title}</p>
                        <p className="text-muted text-sm">
                          {l.classLabel} · {l.subject} · {fmtDate(l.plannedOn)}
                        </p>
                        {l.objectives ? <p className="mt-2 text-sm">{l.objectives}</p> : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={l.status} />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={d.busy}
                          onClick={() =>
                            d.send("PATCH", `/teacher/lessons/${l.id}`, { status: next }, (list) =>
                              list.map((x) => (x.id === l.id ? { ...x, status: next } : x)),
                            )
                          }
                        >
                          {next === "taught" ? "Mark taught" : "Undo"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={d.busy}
                          onClick={() =>
                            d.send(
                              "DELETE",
                              `/teacher/lessons/${l.id}`,
                              undefined,
                              (list) => list.filter((x) => x.id !== l.id),
                              "Removed",
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

interface Outbox {
  students: { id: string; name: string; classLabel: string; parentHasLogin: boolean }[];
  sent: { id: string; about: string; body: string; sentAt: string; reply?: string }[];
}

const SAMPLE_OUTBOX: Outbox = {
  students: [
    { id: "c-aarav", name: "Aarav Mehta", classLabel: "7B", parentHasLogin: true },
    { id: "c-diya", name: "Diya Rao", classLabel: "8A", parentHasLogin: false },
  ],
  sent: [
    {
      id: "t1",
      about: "Aarav Mehta · 7B",
      body: "Aarav did very well in today’s reading. Please keep encouraging him.",
      sentAt: "2026-10-23T10:15:00.000Z",
    },
  ],
};

export function TeacherMessages() {
  const d = useData<Outbox>("/teacher/messages", SAMPLE_OUTBOX);
  const [studentId, setStudentId] = useState("");
  const [body, setBody] = useState("");
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const student = d.data.students.find((s) => s.id === studentId) ?? d.data.students[0];
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!student) return;
    const ok = await d.send(
      "POST",
      "/teacher/messages",
      { studentId: student.id, body },
      (o) => ({
        ...o,
        sent: [
          {
            id: sampleId(),
            about: `${student.name} · ${student.classLabel}`,
            body,
            sentAt: new Date().toISOString(),
          },
          ...o.sent,
        ],
      }),
      "Sent to the parent",
    );
    if (ok) setBody("");
  };
  return (
    <>
      <PageHeader
        title="Parent messages"
        description="Send a short note about a student to their parent."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader title="New message" />
          {!student ? (
            <p className="text-muted text-sm">Students of the classes you teach appear here.</p>
          ) : (
            <form onSubmit={submit} className="grid gap-3">
              <Field
                id="student"
                label="About"
                hint={student.parentHasLogin ? undefined : "This parent has no login yet."}
              >
                {(a) => (
                  <Select {...a} value={student.id} onChange={(e) => setStudentId(e.target.value)}>
                    {d.data!.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.classLabel}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field id="body" label="Message" required>
                {(a) => (
                  <Textarea
                    {...a}
                    maxLength={1000}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" disabled={d.busy || body.trim().length < 2}>
                Send
              </Button>
            </form>
          )}
        </Card>
        {!d.data.sent.length ? (
          <EmptyState title="Nothing sent yet" />
        ) : (
          <ul className="grid gap-3">
            {d.data.sent.map((m) => (
              <li key={m.id}>
                <Card>
                  <p className="text-ink font-semibold">{m.about}</p>
                  <p className="text-muted text-xs">{fmtDateTime(m.sentAt)}</p>
                  <p className="mt-2 text-sm whitespace-pre-wrap">{m.body}</p>
                  {m.reply ? (
                    <p className="bg-paper-2 mt-3 rounded-xl p-3 text-sm whitespace-pre-wrap">
                      <span className="font-semibold">Parent replied: </span>
                      {m.reply}
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
