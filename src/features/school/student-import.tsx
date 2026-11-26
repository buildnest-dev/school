"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api/client";

const HEADER = "name,dob,gender,class,section,guardian_name,guardian_relation,guardian_phone";

interface Check {
  batchId: string;
  total: number;
  valid: number;
  invalid: number;
  errors: { line: number; problems: string[] }[];
  canCommit: boolean;
}

/** Adds many students from a CSV file: first a check, then saving only the good rows. */
export function ImportStudents({ onImported }: { onImported: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      toast({
        title: "Couldn’t read the file",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  const preview = () =>
    run(async () =>
      setCheck(await apiRequest<Check>("/imports/students", { method: "POST", body: { csv } })),
    );
  const commit = () =>
    run(async () => {
      const r = await apiRequest<{ message: string }>(`/imports/${check!.batchId}/commit`, {
        method: "POST",
        body: {},
      });
      toast({ title: r.message });
      setOpen(false);
      setCsv("");
      setCheck(null);
      onImported();
    });

  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Add from file
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="Add students from a file"
        description="Save your sheet as CSV, then choose it here."
      >
        <div className="grid gap-3 text-sm">
          <p className="break-all">
            The first line must have these headings: <strong>{HEADER}</strong>. You may also add
            category, address and guardian_email.
          </p>
          <label className="grid gap-1.5 font-semibold">
            CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setCsv(await f.text());
                setCheck(null);
              }}
            />
          </label>
          <label className="grid gap-1.5 font-semibold">
            Or paste the rows
            <Textarea
              rows={5}
              value={csv}
              onChange={(e) => {
                setCsv(e.target.value);
                setCheck(null);
              }}
            />
          </label>
          {check ? (
            <div className="grid gap-2">
              <p role="status">
                {check.valid} of {check.total} rows are ready. {check.invalid} have a problem.
              </p>
              {check.errors.length ? (
                <ul className="text-bad max-h-40 overflow-y-auto">
                  {check.errors.map((x) => (
                    <li key={x.line}>
                      Line {x.line}: {x.problems.join(" ")}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={preview} disabled={busy || csv.length < 10}>
              Check the rows
            </Button>
            {check?.canCommit ? (
              <Button onClick={commit} disabled={busy}>
                {busy ? "Saving…" : `Add ${check.valid} students`}
              </Button>
            ) : null}
          </div>
        </div>
      </Dialog>
    </>
  );
}
