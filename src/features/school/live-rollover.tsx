"use client";

import { useState } from "react";
import { PageHeader, StatGrid } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import { fmtDate } from "../shared/format";

interface Year {
  id: string;
  label: string;
  startsOn: string;
  endsOn: string;
  current: boolean;
}
interface Summary {
  label: string;
  promoted: number;
  graduating: number;
  heldBack: number;
  byClass: { to: string; students: number }[];
}
interface Found {
  id: string;
  name: string;
  classSection: string;
}

/**
 * Starts the new academic year on the server: pick the dates and who repeats the year, look at the
 * preview, type the year to confirm. The server does it all in one transaction.
 */
export function LiveRollover() {
  const { toast } = useToast();
  const years = useAsync(() => apiRequest<{ items: Year[] }>("/academic-years"), []);
  const [form, setForm] = useState({ label: "", startsOn: "", endsOn: "" });
  const [held, setHeld] = useState<Found[]>([]);
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [preview, setPreview] = useState<Summary | null>(null);
  const [done, setDone] = useState<Summary | null>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  if (years.error) return <ErrorState message={years.error.message} onRetry={years.reload} />;
  if (!years.data) return <LoadingBlock rows={3} />;
  const current = years.data.items.find((y) => y.current);

  // Any change to the plan makes the preview out of date.
  const change = (f: Partial<typeof form>) => {
    setForm({ ...form, ...f });
    setPreview(null);
    setConfirm("");
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast({
        title: "Couldn’t continue",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const send = (isPreview: boolean) =>
    apiRequest<Summary>("/academic-years/rollover", {
      method: "POST",
      body: { ...form, holdBack: held.map((h) => h.id), preview: isPreview },
    });
  const search = () =>
    run(async () => {
      const r = await apiRequest<{ items: Found[] }>("/students", {
        query: { q, pageSize: 20, "filter[status]": "active" },
      });
      setFound(r.items);
    });

  const result = done ?? preview;
  return (
    <>
      <PageHeader
        title="Academic-year rollover"
        description={
          current
            ? `Current year: ${current.label} (${fmtDate(current.startsOn)} to ${fmtDate(current.endsOn)}).`
            : "Start the new academic year and move students to their next class."
        }
      />
      {done ? (
        <Card className="mb-5">
          <CardHeader title={`${done.label} has started`} hint="Students have been moved." />
        </Card>
      ) : (
        <div className="mb-5 grid items-start gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="1. The new year" />
            <div className="grid gap-3">
              <Field id="label" label="Year" hint="Like 2027-28" required>
                {(a) => (
                  <Input
                    {...a}
                    value={form.label}
                    onChange={(e) => change({ label: e.target.value })}
                  />
                )}
              </Field>
              <Field id="startsOn" label="Starts on" required>
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={form.startsOn}
                    onChange={(e) => change({ startsOn: e.target.value })}
                  />
                )}
              </Field>
              <Field id="endsOn" label="Ends on" required>
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={form.endsOn}
                    onChange={(e) => change({ endsOn: e.target.value })}
                  />
                )}
              </Field>
            </div>
          </Card>
          <Card>
            <CardHeader title="2. Who repeats the year" hint="Everyone else moves up one class." />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <Input
                aria-label="Search students"
                placeholder="Search by name or admission no."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Button type="submit" variant="ghost" disabled={busy || !q.trim()}>
                Search
              </Button>
            </form>
            <ul className="mt-3 grid gap-2 text-sm">
              {found
                .filter((f) => !held.some((h) => h.id === f.id))
                .map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2">
                    <span>
                      {f.name} · {f.classSection}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setHeld([...held, f]);
                        setPreview(null);
                      }}
                    >
                      Hold back
                    </Button>
                  </li>
                ))}
            </ul>
            {held.length ? (
              <>
                <p className="text-ink mt-4 mb-2 text-sm font-semibold">
                  Repeating ({held.length})
                </p>
                <ul className="grid gap-2 text-sm">
                  {held.map((h) => (
                    <li key={h.id} className="flex items-center justify-between gap-2">
                      <span>
                        {h.name} · {h.classSection}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setHeld(held.filter((x) => x.id !== h.id));
                          setPreview(null);
                        }}
                      >
                        Undo
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </Card>
        </div>
      )}

      {!done ? (
        <Button
          disabled={busy || !form.label || !form.startsOn || !form.endsOn}
          onClick={() => run(async () => setPreview(await send(true)))}
        >
          Preview the rollover
        </Button>
      ) : null}

      {result ? (
        <div className="mt-5 grid gap-5">
          <StatGrid
            stats={[
              { label: "Students moving up", value: String(result.promoted) },
              { label: "Students graduating", value: String(result.graduating) },
              { label: "Students repeating", value: String(result.heldBack) },
            ]}
          />
          <Card className="max-w-xl">
            <CardHeader title="Classes after the rollover" />
            <ul className="grid gap-2 text-sm">
              {result.byClass.map((c) => (
                <li key={c.to} className="flex justify-between">
                  <span>{c.to}</span>
                  <span className="font-semibold tabular-nums">{c.students}</span>
                </li>
              ))}
            </ul>
          </Card>
          {!done ? (
            <Card className="max-w-xl">
              <CardHeader title="3. Confirm" hint="This cannot be undone from this screen." />
              <div className="grid gap-3">
                <Field id="confirm" label={`Type ${result.label} to confirm`} required>
                  {(a) => (
                    <Input {...a} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                  )}
                </Field>
                <Button
                  disabled={busy || confirm.trim() !== result.label}
                  onClick={() =>
                    run(async () => {
                      setDone(await send(false));
                      years.reload();
                    })
                  }
                >
                  Start {result.label}
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
