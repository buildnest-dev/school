"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env, todayIso } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api/client";
import { fmtDate } from "../shared/format";
import { useData } from "../shared/use-data";
import { ChildPage } from "./child";

interface Work {
  id: string;
  title: string;
  subject: string;
  description: string;
  due: string;
  text: string;
  link: string;
  submittedOn: string;
  grade: string;
  feedback: string;
  checked: boolean;
}

function WorkCard({
  w,
  busy,
  onSend,
}: {
  w: Work;
  busy: boolean;
  onSend: (text: string, link: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(w.text);
  const [link, setLink] = useState(w.link);
  return (
    <Card>
      <p className="text-ink font-semibold">{w.title}</p>
      <p className="text-muted text-xs">
        {w.subject} · due {fmtDate(w.due)}
        {w.submittedOn ? ` · sent ${fmtDate(w.submittedOn)}` : " · not sent yet"}
      </p>
      {w.description ? <p className="mt-2 text-sm">{w.description}</p> : null}
      {w.checked ? (
        <div className="bg-paper-2 mt-3 rounded-xl p-3 text-sm">
          <p className="font-semibold">Teacher’s feedback{w.grade ? ` · ${w.grade}` : ""}</p>
          {w.feedback ? <p>{w.feedback}</p> : null}
        </div>
      ) : open ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSend(text, link);
            setOpen(false);
          }}
        >
          <Textarea
            aria-label={`Answer for ${w.title}`}
            placeholder="Write the answer"
            maxLength={4000}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Input
            type="url"
            aria-label={`Link for ${w.title}`}
            placeholder="Or a https:// link to your file (optional)"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={busy || (!text.trim() && !link.trim())}>
              Send to teacher
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
          {w.submittedOn ? "Change answer" : "Write answer"}
        </Button>
      )}
    </Card>
  );
}

function WorkList({ childId }: { childId: string }) {
  const path = `/me/children/${childId}/homework-submissions`;
  const d = useData<Work[]>(path, [
    {
      id: "h1",
      title: "Tenses practice",
      subject: "English",
      description: "Write five sentences in the past tense.",
      due: "2026-10-28",
      text: "",
      link: "",
      submittedOn: "",
      grade: "",
      feedback: "",
      checked: false,
    },
  ]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  if (!d.data.length) return <EmptyState title="No homework to answer" />;
  return (
    <ul className="grid max-w-3xl gap-3">
      {d.data.map((w) => (
        <li key={w.id}>
          <WorkCard
            w={w}
            busy={d.busy}
            onSend={(text, link) =>
              d.send(
                "POST",
                path,
                { homeworkId: w.id, text, link },
                (l) =>
                  l.map((x) => (x.id === w.id ? { ...x, text, link, submittedOn: todayIso() } : x)),
                "Sent to the teacher",
              )
            }
          />
        </li>
      ))}
    </ul>
  );
}

export function FamilyAnswers() {
  return (
    <ChildPage title="Send homework" description="Answers and teacher feedback.">
      {(id) => <WorkList key={id} childId={id} />}
    </ChildPage>
  );
}

interface Test {
  id: string;
  title: string;
  subject: string;
  durationMin: number;
  questions: number;
  total: number;
  open: boolean;
  done: boolean;
  score: number | null;
}
interface Paper {
  endsAt: string;
  questions: { text: string; options: string[]; marks: number }[];
}

const SAMPLE_PAPER = [
  { text: "Past tense of ‘go’?", options: ["goed", "went", "gone"], marks: 1 },
  { text: "Past tense of ‘eat’?", options: ["ate", "eated"], marks: 1 },
];

const samplePaper = (minutes: number): Paper => ({
  endsAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  questions: SAMPLE_PAPER,
});

function Taking({
  childId,
  test,
  paper,
  onDone,
}: {
  childId: string;
  test: Test;
  paper: Paper;
  onDone: (score: number) => void;
}) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<number[]>(() => paper.questions.map(() => -1));
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () =>
      setLeft(Math.max(0, Math.round((Date.parse(paper.endsAt) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [paper.endsAt]);

  const submit = async () => {
    setBusy(true);
    try {
      const score =
        env.dataSource === "mock"
          ? answers.filter((a, i) => a === [1, 0][i]).length
          : (
              await apiRequest<{ score: number }>(`/me/children/${childId}/quizzes/${test.id}`, {
                method: "POST",
                body: { action: "submit", answers },
              })
            ).score;
      onDone(score);
    } catch (e) {
      toast({
        title: "Couldn’t send the test",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid max-w-3xl gap-3">
      <p className="text-ink font-semibold" role="timer">
        {test.title}
        {left === null
          ? ""
          : left
            ? ` · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")} left`
            : " · time is up, send now"}
      </p>
      {paper.questions.map((q, i) => (
        <Card key={i}>
          <fieldset className="grid gap-2">
            <legend className="text-ink font-semibold">
              {i + 1}. {q.text}
            </legend>
            {q.options.map((o, n) => (
              <label key={n} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={`q${i}`}
                  checked={answers[i] === n}
                  onChange={() => setAnswers(answers.map((a, x) => (x === i ? n : a)))}
                />
                {o}
              </label>
            ))}
          </fieldset>
        </Card>
      ))}
      <div>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Sending…" : "Send answers"}
        </Button>
      </div>
    </div>
  );
}

function TestList({ childId }: { childId: string }) {
  const { toast } = useToast();
  const student = useSession().user?.role === "student";
  const path = `/me/children/${childId}/quizzes`;
  const d = useData<Test[]>(path, [
    {
      id: "q1",
      title: "Tenses quick check",
      subject: "English",
      durationMin: 10,
      questions: 2,
      total: 2,
      open: true,
      done: false,
      score: null,
    },
  ]);
  const [taking, setTaking] = useState<{ test: Test; paper: Paper } | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  if (taking)
    return (
      <Taking
        childId={childId}
        {...taking}
        onDone={(score) => {
          setScores({ ...scores, [taking.test.id]: score });
          setTaking(null);
          toast({ title: `Test sent. Score ${score} of ${taking.test.total}` });
          d.reload();
        }}
      />
    );
  if (!d.data.length) return <EmptyState title="No tests yet" />;
  const start = async (test: Test) => {
    try {
      const paper =
        env.dataSource === "mock"
          ? samplePaper(test.durationMin)
          : await apiRequest<Paper>(`${path}/${test.id}`, {
              method: "POST",
              body: { action: "start" },
            });
      setTaking({ test, paper });
    } catch (e) {
      toast({
        title: "Couldn’t start the test",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <ul className="grid max-w-3xl gap-3">
      {d.data.map((t) => {
        const score = scores[t.id] ?? t.score;
        return (
          <li key={t.id}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-ink font-semibold">{t.title}</p>
                <p className="text-muted text-sm">
                  {t.subject} · {t.questions} questions · {t.durationMin} min
                </p>
              </div>
              {score !== null ? (
                <span className="text-ink font-bold">
                  {score} / {t.total}
                </span>
              ) : t.open && student ? (
                <Button size="sm" onClick={() => void start(t)}>
                  Start test
                </Button>
              ) : (
                <span className="text-muted text-sm">
                  {t.open ? "Taken from the student’s own login" : "Closed"}
                </span>
              )}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

export function FamilyQuizzes() {
  return (
    <ChildPage title="Online tests" description="Tests from teachers.">
      {(id) => <TestList key={id} childId={id} />}
    </ChildPage>
  );
}
