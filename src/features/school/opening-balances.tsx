"use client";

import { useEffect, useState } from "react";
import { DevNote, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { ApiError, apiRequest } from "@/lib/api/client";
import { rupees } from "../shared/format";

/** An example line built from real admission numbers of this school. */
const example = (a: string, b: string) =>
  `${a},Term 1 fee,12500,5000,2026-04-30,2026-04-10,upi,UTR1234567
${b},Term 1 fee,12500,0,2026-04-30`;

type Parsed = Record<string, unknown>;

/** One line per student item: admission no, item, amount, paid so far, due date [, paid on, mode, reference]. */
function parse(text: string): { rows: Parsed[]; problem?: string } {
  const rows: Parsed[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const [i, line] of lines.entries()) {
    const c = line.split(",").map((x) => x.trim());
    if (i === 0 && /^admission/i.test(c[0] ?? "")) continue; // a header row
    if (c.length < 5) return { rows, problem: `Line ${i + 1}: needs at least 5 values.` };
    const amount = Number(c[2]);
    const paid = Number(c[3] || 0);
    if (!Number.isFinite(amount) || !Number.isFinite(paid))
      return { rows, problem: `Line ${i + 1}: amount and paid must be numbers.` };
    rows.push({
      admissionNo: c[0],
      title: c[1],
      amount,
      paid,
      dueOn: c[4],
      ...(c[5] ? { paidOn: c[5] } : {}),
      ...(c[6] ? { mode: c[6].toLowerCase() } : {}),
      ...(c[7] ? { reference: c[7] } : {}),
    });
  }
  return { rows };
}

/** The accountant's first job: what each family already owed and paid before the school joined. */
export function OpeningBalances() {
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [nos, setNos] = useState<string[]>([]);
  useEffect(() => {
    apiRequest<{ items: { admissionNo: string }[] }>("/students", { query: { pageSize: 2 } })
      .then((r) => setNos(r.items.map((x) => x.admissionNo)))
      .catch(() => undefined);
  }, []);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [checked, setChecked] = useState<{
    rows: number;
    totalDue: number;
    totalPaid: number;
  } | null>(null);

  const send = async (commit: boolean) => {
    const { rows, problem } = parse(text);
    if (problem) return setProblems([problem]);
    if (rows.length === 0) return setProblems(["Paste at least one line."]);
    setBusy(true);
    setProblems([]);
    try {
      const r = await apiRequest<{ rows: number; totalDue: number; totalPaid: number }>(
        "/fees/opening-balances",
        { method: "POST", body: { rows, commit } },
      );
      if (commit) {
        toast({ title: "Saved", description: `${r.rows} entries added to the fee ledger.` });
        setText("");
        setChecked(null);
      } else setChecked(r);
    } catch (e) {
      setChecked(null);
      if (e instanceof ApiError && e.status === 422) {
        setProblems(e.fieldErrors?.rows ?? [e.message]);
      } else setProblems([e instanceof Error ? e.message : "Please try again."]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Opening balances"
        description="Enter what each family already owed and paid this year, before you started here. Nothing is saved until every line passes the check."
      />
      {env.dataSource !== "api" ? (
        <DevNote>Opening balances need the live backend.</DevNote>
      ) : (
        <Card className="grid max-w-3xl gap-4">
          <p className="text-muted text-sm">
            One line per student and item:{" "}
            <code>admission no, item, amount, paid so far, due date</code>, and optionally{" "}
            <code>paid on, mode, reference</code>. Dates are YYYY-MM-DD. Mode is cash (default),
            upi, cheque, dd, netbanking or card; anything except cash needs a reference. The
            admission number is in the Student ledger list and the Students screen
            {nos[0] ? ` (for example ${nos[0]})` : ""}.
          </p>
          <label htmlFor="ob-text" className="text-sm font-semibold">
            Lines
          </label>
          <textarea
            id="ob-text"
            rows={10}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setChecked(null);
            }}
            placeholder={
              nos.length === 2
                ? example(nos[0]!, nos[1]!)
                : "Admission no, item, amount, paid so far, due date"
            }
            className="border-line bg-surface min-h-48 w-full rounded-md border p-3 font-mono text-sm"
          />
          {problems.length ? (
            <ul role="alert" className="text-bad grid gap-1 text-sm font-medium">
              {problems.slice(0, 15).map((p) => (
                <li key={p}>{p}</li>
              ))}
              {problems.length > 15 ? <li>…and {problems.length - 15} more.</li> : null}
            </ul>
          ) : null}
          {checked ? (
            <p className="text-sm">
              All {checked.rows} lines are fine. Total owed {rupees(checked.totalDue)}, already paid{" "}
              {rupees(checked.totalPaid)}.
            </p>
          ) : null}
          {!checked ? (
            <p className="text-muted text-sm">
              Press Check first. Save turns on once every line passes.
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="ghost" disabled={busy || !text.trim()} onClick={() => send(false)}>
              Check
            </Button>
            <Button disabled={busy || !checked} onClick={() => send(true)}>
              Save to the ledger
            </Button>
          </div>
        </Card>
      )}
    </>
  );
}
