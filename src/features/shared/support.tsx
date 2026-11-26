"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import { ApiAction, QuickAdd } from "./quick-add";

interface Ticket {
  id: string;
  number?: string;
  subject: string;
  status: string;
  priority: string;
}
interface Message {
  id: string;
  fromStaff: boolean;
  internal?: boolean;
  body: string;
  createdAt: string;
}

const choices = (values: string[]) =>
  values.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) }));

/** One support request with its messages. `team` is the ZAQSA side: notes and status buttons. */
export function TicketThread({
  id,
  team,
  onChanged,
}: {
  id: string;
  team?: boolean;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const base = team ? `/platform/tickets/${id}` : `/support/tickets/${id}`;
  const d = useAsync(() => apiRequest<Ticket & { messages: Message[] }>(base), [base]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const t = d.data;
  const changed = () => {
    d.reload();
    onChanged?.();
  };
  const send = async (internal: boolean) => {
    setBusy(true);
    try {
      await apiRequest(`${base}/messages`, {
        method: "POST",
        body: team ? { body: text, internal } : { body: text },
      });
      setText("");
      toast({ title: internal ? "Note saved" : "Reply sent" });
      changed();
    } catch (e) {
      toast({
        title: "Couldn’t send",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-4 grid gap-3 text-sm">
      <p className="flex items-center gap-2">
        <strong>{t.subject}</strong>
        <StatusBadge status={t.status} />
      </p>
      <ul className="grid max-h-64 gap-2 overflow-y-auto">
        {t.messages.map((m) => (
          <li key={m.id} className="border-line rounded-lg border p-3">
            <p className="text-muted text-xs">
              {m.internal
                ? "Team note (the school cannot see it)"
                : m.fromStaff
                  ? "ZAQSA"
                  : "School"}{" "}
              · {new Date(m.createdAt).toLocaleString("en-IN")}
            </p>
            <p className="whitespace-pre-wrap">{m.body}</p>
          </li>
        ))}
      </ul>
      {t.status === "closed" ? (
        <p className="text-muted">This request is closed.</p>
      ) : (
        <>
          <Textarea
            rows={3}
            aria-label="Your reply"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => send(false)} disabled={busy || !text.trim()}>
              Send reply
            </Button>
            {team ? (
              <>
                <Button variant="ghost" onClick={() => send(true)} disabled={busy || !text.trim()}>
                  Save as team note
                </Button>
                <ApiAction
                  label="Mark resolved"
                  method="PATCH"
                  endpoint={base}
                  body={{ status: "resolved" }}
                  onDone={changed}
                />
                <ApiAction
                  label="Close request"
                  method="PATCH"
                  endpoint={base}
                  body={{ status: "closed" }}
                  onDone={changed}
                />
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

/** A school's requests to ZAQSA: open a new one and read the replies. */
export function SchoolSupport() {
  const d = useAsync(() => apiRequest<{ items: Ticket[] }>("/support/tickets"), []);
  const [open, setOpen] = useState("");
  return (
    <Card className="grid max-w-2xl gap-3">
      <CardHeader title="Help from ZAQSA" hint="Ask a question or report a problem." />
      <div>
        <QuickAdd
          label="New request"
          title="Ask ZAQSA for help"
          endpoint="/support/tickets"
          onCreated={d.reload}
          fields={[
            { key: "subject", label: "Subject" },
            { key: "body", label: "Tell us more", type: "textarea" },
            {
              key: "category",
              label: "Kind",
              type: "select",
              options: choices(["question", "problem", "billing", "request"]),
            },
            {
              key: "priority",
              label: "How urgent",
              type: "select",
              options: choices(["normal", "low", "high", "urgent"]),
            },
          ]}
        />
      </div>
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={2} />
      ) : d.data.items.length === 0 ? (
        <p className="text-muted text-sm">No requests yet.</p>
      ) : (
        <ul className="grid gap-2">
          {d.data.items.map((t) => (
            <li key={t.id} className="border-line rounded-lg border p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left text-sm"
                aria-expanded={open === t.id}
                onClick={() => setOpen((v) => (v === t.id ? "" : t.id))}
              >
                <span className="font-semibold">{t.subject}</span>
                <StatusBadge status={t.status} />
              </button>
              {open === t.id ? <TicketThread id={t.id} onChanged={d.reload} /> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
