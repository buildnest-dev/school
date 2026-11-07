"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { ApiError, apiRequest } from "@/lib/api/client";
import { compressImage } from "@/lib/compress-image";
import { fmtDate, rupees } from "../shared/format";

interface Proof {
  id: string;
  amount: number;
  reference: string | null;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  submittedAt: string;
}
const LABEL = {
  pending: "Waiting for the school",
  approved: "Confirmed",
  rejected: "Not accepted",
};

/** After paying by UPI, the parent uploads the screenshot here and sees whether the school confirmed it. */
export function ProofUpload({ studentId, due }: { studentId: string; due: number }) {
  const { toast } = useToast();
  const [items, setItems] = useState<Proof[]>([]);
  const [amount, setAmount] = useState(String(due));
  const [reference, setReference] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (env.dataSource !== "api") return;
    let alive = true;
    apiRequest<{ items: Proof[] }>("/payment-proofs", { query: { studentId } })
      .then((r) => alive && setItems(r.items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [studentId, tick]);

  if (env.dataSource !== "api") return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const n = Number(amount);
    if (!file) return setError("Choose the screenshot of your payment.");
    if (!(n > 0)) return setError("Enter the amount you paid.");
    setBusy(true);
    try {
      const image = await compressImage(file);
      await apiRequest("/payment-proofs", {
        method: "POST",
        body: { studentId, amountRupees: n, reference: reference.trim() || undefined, image },
      });
      toast({ title: "Sent to the school", description: "They will confirm your payment soon." });
      setFile(null);
      setReference("");
      setTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : "Could not send.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mb-5 max-w-sm">
      <h2 className="text-lg font-semibold">Already paid? Send the screenshot</h2>
      <form onSubmit={submit} className="mt-3 grid gap-3" noValidate>
        <Field id="proof-amount" label="Amount paid (₹)" required>
          {(a) => (
            <Input
              {...a}
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}
        </Field>
        <Field id="proof-ref" label="UPI transaction ID" hint="Shown in your UPI app after paying.">
          {(a) => (
            <Input
              {...a}
              autoComplete="off"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </Field>
        <Field id="proof-file" label="Screenshot" required>
          {(a) => (
            <Input
              {...a}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          )}
        </Field>
        {error ? (
          <p role="alert" className="text-bad text-sm font-medium">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send to the school"}
        </Button>
      </form>
      {items.length ? (
        <ul className="mt-4 grid gap-2 text-sm">
          {items.slice(0, 5).map((p) => (
            <li key={p.id} className="border-line rounded-md border p-2">
              <span className="font-semibold tabular-nums">{rupees(p.amount)}</span> ·{" "}
              {fmtDate(p.submittedAt)} · <span data-status={p.status}>{LABEL[p.status]}</span>
              {p.status === "rejected" && p.reviewNote ? (
                <span className="text-muted block">Reason: {p.reviewNote}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
