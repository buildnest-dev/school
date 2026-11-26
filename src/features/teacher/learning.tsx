"use client";

import { ExternalLink } from "lucide-react";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { fmtDate } from "../shared/format";
import { sampleId, useData } from "../shared/use-data";

interface Answer {
  id: string;
  student: string;
  homework: string;
  classLabel: string;
  subject: string;
  text: string;
  link: string;
  submittedOn: string;
  grade: string;
  feedback: string;
  checked: boolean;
}

function AnswerCard({
  a,
  busy,
  onCheck,
}: {
  a: Answer;
  busy: boolean;
  onCheck: (grade: string, feedback: string) => void;
}) {
  const [grade, setGrade] = useState(a.grade);
  const [feedback, setFeedback] = useState(a.feedback);
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-ink font-semibold">
            {a.student} · {a.homework}
          </p>
          <p className="text-muted text-xs">
            {a.classLabel} · {a.subject} · sent {fmtDate(a.submittedOn)}
          </p>
        </div>
        <StatusBadge status={a.checked ? "completed" : "pending"} />
      </div>
      {a.text ? <p className="mt-2 text-sm whitespace-pre-wrap">{a.text}</p> : null}
      {a.link ? (
        <Button asChild variant="ghost" size="sm" className="mt-2">
          <a href={a.link} target="_blank" rel="noopener noreferrer">
            Open link <ExternalLink className="size-4" aria-hidden="true" />
          </a>
        </Button>
      ) : null}
      <form
        className="mt-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onCheck(grade, feedback);
        }}
      >
        <Input
          aria-label={`Grade for ${a.student}`}
          placeholder="Grade"
          className="w-28"
          maxLength={20}
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        />
        <Input
          aria-label={`Feedback for ${a.student}`}
          placeholder="Feedback"
          className="min-w-48 flex-1"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={busy}>
          {a.checked ? "Update" : "Send feedback"}
        </Button>
      </form>
    </Card>
  );
}

export function TeacherSubmissions() {
  const d = useData<Answer[]>("/homework-submissions", [
    {
      id: "a1",
      student: "Aarav Mehta",
      homework: "Tenses practice",
      classLabel: "7 B",
      subject: "English",
      text: "1. She has gone home. 2. They were playing.",
      link: "",
      submittedOn: "2026-10-25",
      grade: "",
      feedback: "",
      checked: false,
    },
  ]);
  return (
    <>
      <PageHeader title="Homework answers" description="Read what students sent and reply." />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={3} />
      ) : !d.data.length ? (
        <EmptyState title="No answers yet" hint="Answers to your homework appear here." />
      ) : (
        <ul className="grid max-w-3xl gap-3">
          {d.data.map((a) => (
            <li key={a.id}>
              <AnswerCard
                a={a}
                busy={d.busy}
                onCheck={(grade, feedback) =>
                  d.send(
                    "PATCH",
                    "/homework-submissions",
                    { id: a.id, grade, feedback },
                    (l) =>
                      l.map((x) => (x.id === a.id ? { ...x, grade, feedback, checked: true } : x)),
                    "Feedback sent",
                  )
                }
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

interface QuizRow {
  id: string;
  title: string;
  classLabel: string;
  subject: string;
  status: "draft" | "open" | "closed";
  durationMin: number;
  questions: number;
  total: number;
  results: { student: string; score: number }[];
}
interface Draft {
  text: string;
  options: string;
  answer: number;
}
interface Pair {
  sectionId: string;
  subjectId: string;
  classLabel: string;
  subject: string;
}

const blank = (): Draft => ({ text: "", options: "", answer: 0 });
const linesIn = (v: string) =>
  v
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

function NewQuiz({
  busy,
  onSave,
}: {
  busy: boolean;
  onSave: (body: object, label: Pair) => Promise<boolean>;
}) {
  const pairs = useData<Pair[]>("/teacher/class-subjects", [
    { sectionId: "8a", subjectId: "eng", classLabel: "8A", subject: "English" },
  ]);
  const [picked, setPicked] = useState(0);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("15");
  const [questions, setQuestions] = useState<Draft[]>([blank()]);
  const pair = pairs.data?.[picked];
  const ready =
    title.trim().length >= 3 &&
    questions.every((q) => q.text.trim().length >= 2 && linesIn(q.options).length >= 2);
  const set = (i: number, patch: Partial<Draft>) =>
    setQuestions(questions.map((q, n) => (n === i ? { ...q, ...patch } : q)));
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!pair) return;
    const ok = await onSave(
      {
        sectionId: pair.sectionId,
        subjectId: pair.subjectId,
        title,
        durationMin: Number(minutes) || 15,
        questions: questions.map((q) => ({
          text: q.text,
          options: linesIn(q.options),
          answer: Math.min(q.answer, linesIn(q.options).length - 1),
          marks: 1,
        })),
      },
      pair,
    );
    if (ok) {
      setTitle("");
      setQuestions([blank()]);
    }
  };
  if (pairs.data && !pairs.data.length)
    return (
      <p className="text-muted text-sm">
        Your classes appear here once the school adds you to the timetable.
      </p>
    );
  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field id="quiz-pair" label="Class and subject" required>
        {(a) => (
          <Select {...a} value={picked} onChange={(e) => setPicked(Number(e.target.value))}>
            {pairs.data?.map((p, i) => (
              <option key={`${p.sectionId}-${p.subjectId}`} value={i}>
                {p.classLabel} · {p.subject}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field id="quiz-title" label="Test name" required>
        {(a) => <Input {...a} value={title} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field id="quiz-min" label="Minutes allowed">
        {(a) => (
          <Input
            {...a}
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        )}
      </Field>
      {questions.map((q, i) => (
        <fieldset key={i} className="border-line grid gap-2 rounded-2xl border p-3">
          <legend className="px-1 text-sm font-semibold">Question {i + 1}</legend>
          <Textarea
            aria-label={`Question ${i + 1}`}
            placeholder="Question"
            value={q.text}
            onChange={(e) => set(i, { text: e.target.value })}
          />
          <Textarea
            aria-label={`Choices for question ${i + 1}`}
            placeholder="Choices, one on each line"
            value={q.options}
            onChange={(e) => set(i, { options: e.target.value })}
          />
          <Select
            aria-label={`Right answer for question ${i + 1}`}
            value={q.answer}
            onChange={(e) => set(i, { answer: Number(e.target.value) })}
          >
            {(linesIn(q.options).length ? linesIn(q.options) : ["Add choices first"]).map(
              (o, n) => (
                <option key={n} value={n}>
                  Right answer: {o}
                </option>
              ),
            )}
          </Select>
          {questions.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setQuestions(questions.filter((_, n) => n !== i))}
            >
              Remove question
            </Button>
          ) : null}
        </fieldset>
      ))}
      <Button
        type="button"
        variant="ghost"
        disabled={questions.length >= 50}
        onClick={() => setQuestions([...questions, blank()])}
      >
        Add a question
      </Button>
      <Button type="submit" disabled={busy || !ready}>
        Save test
      </Button>
    </form>
  );
}

export function TeacherQuizzes() {
  const d = useData<QuizRow[]>("/quizzes", [
    {
      id: "q1",
      title: "Tenses quick check",
      classLabel: "8A",
      subject: "English",
      status: "open",
      durationMin: 10,
      questions: 5,
      total: 5,
      results: [
        { student: "Aarav Mehta", score: 4 },
        { student: "Diya Shah", score: 3 },
      ],
    },
  ]);
  const move = (q: QuizRow, status: "open" | "closed") =>
    d.send(
      "PATCH",
      `/quizzes/${q.id}`,
      { status },
      (l) => l.map((x) => (x.id === q.id ? { ...x, status } : x)),
      status === "open" ? "Test opened" : "Test closed",
    );
  return (
    <>
      <PageHeader
        title="Online tests"
        description="Short multiple-choice tests, marked automatically."
      />
      <div className="grid items-start gap-5 lg:grid-cols-[400px_1fr]">
        <Card>
          <CardHeader title="New test" />
          <NewQuiz
            busy={d.busy}
            onSave={(body, pair) =>
              d.send(
                "POST",
                "/quizzes",
                body,
                (l) => {
                  const b = body as { title: string; durationMin: number; questions: unknown[] };
                  return [
                    {
                      id: sampleId(),
                      title: b.title,
                      classLabel: pair.classLabel,
                      subject: pair.subject,
                      status: "draft",
                      durationMin: b.durationMin,
                      questions: b.questions.length,
                      total: b.questions.length,
                      results: [],
                    },
                    ...l,
                  ];
                },
                "Test saved",
              )
            }
          />
        </Card>
        {d.error ? (
          <ErrorState message={d.error.message} onRetry={d.reload} />
        ) : !d.data ? (
          <LoadingBlock rows={3} />
        ) : !d.data.length ? (
          <EmptyState title="No tests yet" />
        ) : (
          <ul className="grid gap-3">
            {d.data.map((q) => (
              <li key={q.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-ink font-semibold">{q.title}</p>
                      <p className="text-muted text-xs">
                        {q.classLabel} · {q.subject} · {q.questions} questions · {q.durationMin} min
                      </p>
                    </div>
                    <StatusBadge status={q.status} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {q.status !== "open" ? (
                      <Button size="sm" disabled={d.busy} onClick={() => move(q, "open")}>
                        Open to class
                      </Button>
                    ) : (
                      <Button size="sm" disabled={d.busy} onClick={() => move(q, "closed")}>
                        Close test
                      </Button>
                    )}
                    {!q.results.length ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={d.busy}
                        onClick={() =>
                          d.send(
                            "DELETE",
                            `/quizzes/${q.id}`,
                            undefined,
                            (l) => l.filter((x) => x.id !== q.id),
                            "Test removed",
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  {q.results.length ? (
                    <ul className="mt-3 grid gap-1 text-sm">
                      {q.results.map((r, i) => (
                        <li key={i} className="flex justify-between gap-3">
                          <span>{r.student}</span>
                          <span className="font-semibold">
                            {r.score} / {q.total}
                          </span>
                        </li>
                      ))}
                    </ul>
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
