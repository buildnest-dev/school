"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useSession } from "@/hooks/use-session";
import { fmtDate } from "./format";
import { sampleId, useData } from "./use-data";

interface PollRow {
  id: string;
  question: string;
  audience: string;
  status: "open" | "closed";
  options: string[];
  myChoice: number | null;
  counts: number[] | null;
}

const LEADERS = ["school_owner", "principal", "vice_principal"];

function Polls() {
  const role = useSession().user?.role ?? "";
  const manage = LEADERS.includes(role);
  const d = useData<PollRow[]>("/polls", [
    {
      id: "p1",
      question: "Which day suits the parent meeting?",
      audience: "all",
      status: "open",
      options: ["Saturday morning", "Friday evening"],
      myChoice: null,
      counts: manage ? [12, 7] : null,
    },
  ]);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState("");
  const [audience, setAudience] = useState("all");
  const list = options
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  const create = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await d.send(
      "POST",
      "/polls",
      { question, options: list, audience },
      (l) => [
        {
          id: sampleId(),
          question,
          audience,
          status: "open",
          options: list,
          myChoice: null,
          counts: list.map(() => 0),
        },
        ...l,
      ],
      "Poll published",
    );
    if (ok) {
      setQuestion("");
      setOptions("");
    }
  };
  return (
    <div className={manage ? "grid items-start gap-5 lg:grid-cols-[360px_1fr]" : "max-w-3xl"}>
      {manage ? (
        <Card>
          <CardHeader title="New poll" />
          <form onSubmit={create} className="grid gap-3">
            <Field id="poll-q" label="Question" required>
              {(a) => (
                <Input {...a} value={question} onChange={(e) => setQuestion(e.target.value)} />
              )}
            </Field>
            <Field id="poll-o" label="Choices" hint="One on each line, at least two." required>
              {(a) => (
                <Textarea {...a} value={options} onChange={(e) => setOptions(e.target.value)} />
              )}
            </Field>
            <Field id="poll-a" label="Who can vote">
              {(a) => (
                <Select {...a} value={audience} onChange={(e) => setAudience(e.target.value)}>
                  <option value="all">Everyone</option>
                  <option value="staff">Staff</option>
                  <option value="parents">Parents</option>
                  <option value="students">Students</option>
                </Select>
              )}
            </Field>
            <Button
              type="submit"
              disabled={d.busy || question.trim().length < 5 || list.length < 2}
            >
              Publish
            </Button>
          </form>
        </Card>
      ) : null}
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={3} />
      ) : !d.data.length ? (
        <EmptyState title="No polls yet" />
      ) : (
        <ul className="grid gap-3">
          {d.data.map((p) => (
            <li key={p.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-ink font-semibold">{p.question}</p>
                  <StatusBadge status={p.status} />
                </div>
                <ul className="mt-3 grid gap-2">
                  {p.options.map((o, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 text-sm">
                      {p.status === "open" && p.myChoice === null ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={d.busy}
                          onClick={() =>
                            d.send(
                              "POST",
                              `/polls/${p.id}`,
                              { choice: i },
                              (l) =>
                                l.map((x) =>
                                  x.id === p.id
                                    ? {
                                        ...x,
                                        myChoice: i,
                                        counts: (x.counts ?? x.options.map(() => 0)).map((c, n) =>
                                          n === i ? c + 1 : c,
                                        ),
                                      }
                                    : x,
                                ),
                              "Vote recorded",
                            )
                          }
                        >
                          {o}
                        </Button>
                      ) : (
                        <span>
                          {o}
                          {p.myChoice === i ? " (your choice)" : ""}
                        </span>
                      )}
                      {p.counts ? <span className="font-semibold">{p.counts[i]}</span> : null}
                    </li>
                  ))}
                </ul>
                {manage && p.status === "open" ? (
                  <Button
                    size="sm"
                    className="mt-3"
                    disabled={d.busy}
                    onClick={() =>
                      d.send(
                        "PATCH",
                        `/polls/${p.id}`,
                        {},
                        (l) => l.map((x) => (x.id === p.id ? { ...x, status: "closed" } : x)),
                        "Poll closed",
                      )
                    }
                  >
                    Close poll
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Read {
  id: string;
  title: string;
  body: string;
  publishedOn: string;
  acknowledged: boolean;
  readers: string[] | null;
}

function ReadReceipts() {
  const role = useSession().user?.role ?? "";
  const leader = role === "school_owner" || role === "principal";
  const d = useData<Read[]>("/acknowledgements", [
    {
      id: "n1",
      title: "Winter timings from Monday",
      body: "School starts at 8:30 from next week.",
      publishedOn: "2026-10-24",
      acknowledged: false,
      readers: leader ? ["Rahul Mehta", "Kavita Iyer"] : null,
    },
  ]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  if (!d.data.length) return <EmptyState title="No notices yet" />;
  return (
    <ul className="grid max-w-3xl gap-3">
      {d.data.map((n) => (
        <li key={n.id}>
          <Card>
            <p className="text-ink font-semibold">{n.title}</p>
            <p className="text-muted text-xs">{fmtDate(n.publishedOn)}</p>
            <p className="mt-2 text-sm whitespace-pre-wrap">{n.body}</p>
            {n.acknowledged ? (
              <p className="text-ok mt-2 text-sm font-semibold">You confirmed reading this.</p>
            ) : (
              <Button
                size="sm"
                className="mt-3"
                disabled={d.busy}
                onClick={() =>
                  d.send(
                    "POST",
                    "/acknowledgements",
                    { noticeId: n.id },
                    (l) => l.map((x) => (x.id === n.id ? { ...x, acknowledged: true } : x)),
                    "Marked as read",
                  )
                }
              >
                I have read this
              </Button>
            )}
            {n.readers ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer font-semibold">
                  Read by {n.readers.length}
                </summary>
                <p className="text-muted mt-1">{n.readers.join(", ") || "Nobody yet"}</p>
              </details>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function PollsPage() {
  return (
    <>
      <PageHeader
        title="Polls and read receipts"
        description="Vote, and confirm you have read school notices."
      />
      <Tabs defaultValue="polls">
        <TabsList aria-label="Polls and read receipts">
          <TabsTrigger value="polls">Polls</TabsTrigger>
          <TabsTrigger value="reads">Notices to confirm</TabsTrigger>
        </TabsList>
        <TabsContent value="polls">
          <Polls />
        </TabsContent>
        <TabsContent value="reads">
          <ReadReceipts />
        </TabsContent>
      </Tabs>
    </>
  );
}
