"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { ApiError, apiRequest } from "@/lib/api/client";
import { fmtDate } from "../shared/format";

interface Query {
  id: string;
  subject: string;
  body: string;
  reply: string;
  assignedTo: string;
  status: string;
  openedOn: string;
}

/** A parent asks the school a question and sees the answer here. */
export function AskSchool() {
  const { toast } = useToast();
  const list = useAsync(
    () => apiRequest<{ items: Query[] }>("/parent-queries").then((r) => r.items),
    [],
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await apiRequest("/parent-queries", { method: "POST", body: { subject, body } });
      toast({ title: "Sent", description: "The school will reply here." });
      setSubject("");
      setBody("");
      list.reload();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast({
        title: "Couldn’t send",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Ask the school"
        description="Send a question to the school office. Replies show up below."
      />
      <Card className="max-w-2xl">
        <form onSubmit={send} className="grid gap-4" noValidate>
          <Field id="aq-subject" label="Subject" required error={errors.subject?.[0]}>
            {(a) => <Input {...a} autoComplete="off" value={subject} onChange={(e) => setSubject(e.target.value)} />}
          </Field>
          <Field id="aq-body" label="Your question" required error={errors.body?.[0]}>
            {(a) => <Textarea {...a} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}
          </Field>
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send to the school"}
            </Button>
          </div>
        </form>
      </Card>
      <h2 className="mt-8 mb-3 text-lg font-semibold">Your questions</h2>
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingBlock />
      ) : list.data.length === 0 ? (
        <EmptyState title="No questions yet" hint="Anything you send appears here with the reply." />
      ) : (
        <ul className="grid max-w-2xl gap-3">
          {list.data.map((q) => (
            <li key={q.id}>
              <Card className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{q.subject}</span>
                  <StatusBadge status={q.status} />
                </div>
                <p className="text-sm">{q.body}</p>
                <p className="text-muted text-xs">Sent {fmtDate(q.openedOn)}</p>
                {q.reply && (
                  <p className="bg-surface rounded-md p-3 text-sm">
                    <span className="font-semibold">Reply: </span>
                    {q.reply}
                  </p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
