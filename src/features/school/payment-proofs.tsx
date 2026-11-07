"use client";

import { useCallback, useEffect, useState } from "react";
import { DevNote, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { ApiError, apiRequest } from "@/lib/api/client";
import { fmtDate, rupees } from "../shared/format";

interface Proof {
  id: string;
  studentId: string;
  studentName: string;
  classSection: string;
  amount: number;
  reference: string | null;
  submittedAt: string;
}
interface InvoiceRow {
  id: string;
  number: string;
  title: string;
  amount: number;
  paid: number;
}

/**
 * Parents' payment screenshots. The accountant compares each with the bank statement, picks the
 * invoice it pays, and approves; or rejects with a reason. Approving records a normal UPI payment.
 */
export function PaymentProofs() {
  const [items, setItems] = useState<Proof[] | null>(null);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (env.dataSource !== "api") return;
    let alive = true;
    apiRequest<{ items: Proof[] }>("/payment-proofs")
      .then((r) => alive && setItems(r.items))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [tick]);

  return (
    <>
      <PageHeader
        title="Payment screenshots"
        description="Parents who paid by UPI send a screenshot. Check it against your bank statement, then approve or reject."
      />
      {env.dataSource !== "api" ? (
        <DevNote>Payment screenshots need the live backend.</DevNote>
      ) : !items ? (
        <LoadingBlock />
      ) : items.length === 0 ? (
        <EmptyState title="Nothing waiting" hint="New screenshots from parents appear here." />
      ) : (
        <ul className="grid max-w-3xl gap-4">
          {items.map((p) => (
            <li key={p.id}>
              <ProofCard proof={p} onDone={reload} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ProofCard({ proof, onDone }: { proof: Proof; onDone: () => void }) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [reference, setReference] = useState(proof.reference ?? "");
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    apiRequest<{ items: Array<Record<string, unknown>> }>("/fees/invoices", {
      query: { studentId: proof.studentId, pageSize: 100 },
    })
      .then((r) => {
        if (!alive) return;
        const rows = r.items
          .map((i) => ({
            id: String(i.id),
            number: String(i.number),
            title: String(i.term),
            amount: Number(i.amount),
            paid: Number(i.paid),
          }))
          .filter((i) => i.amount - i.paid > 0);
        setInvoices(rows);
        if (rows[0]) setInvoiceId(rows[0].id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [proof.studentId]);

  const decide = async (body: object, done: string) => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/payment-proofs/${proof.id}/decision`, { method: "POST", body });
      toast({ title: done });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="grid gap-4 sm:grid-cols-[200px_1fr]">
      <a
        href={`${env.apiBaseUrl}/payment-proofs/${proof.id}/image`}
        target="_blank"
        rel="noreferrer"
        aria-label="Open the screenshot full size"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${env.apiBaseUrl}/payment-proofs/${proof.id}/image`}
          alt={`Payment screenshot from the parent of ${proof.studentName}`}
          className="border-line max-h-72 w-full rounded-md border object-contain"
        />
      </a>
      <div className="grid content-start gap-3">
        <div>
          <p className="text-lg font-semibold">
            {proof.studentName} <span className="text-muted text-sm">{proof.classSection}</span>
          </p>
          <p className="font-display text-3xl tabular-nums">{rupees(proof.amount)}</p>
          <p className="text-muted text-sm">Sent {fmtDate(proof.submittedAt)}</p>
        </div>
        {rejecting ? (
          <>
            <Field id={`note-${proof.id}`} label="Reason for the parent" required>
              {(a) => <Input {...a} value={note} onChange={(e) => setNote(e.target.value)} />}
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy || note.trim().length < 3}
                onClick={() => decide({ approve: false, note }, "Screenshot rejected")}
              >
                Reject
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(false)}>
                Back
              </Button>
            </div>
          </>
        ) : (
          <>
            <Field id={`ref-${proof.id}`} label="UPI transaction ID" required>
              {(a) => (
                <Input {...a} value={reference} onChange={(e) => setReference(e.target.value)} />
              )}
            </Field>
            <Field id={`inv-${proof.id}`} label="Pays this invoice" required>
              {(a) => (
                <Select {...a} value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
                  {invoices.length === 0 ? (
                    <option value="">No invoice with a balance</option>
                  ) : null}
                  {invoices.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.number} · {i.title} · due {rupees(i.amount - i.paid)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <div className="flex gap-2">
              <Button
                disabled={busy || !invoiceId || reference.trim().length < 3}
                onClick={() =>
                  decide(
                    { approve: true, invoiceId, reference: reference.trim() },
                    "Payment recorded",
                  )
                }
              >
                Approve
              </Button>
              <Button variant="ghost" onClick={() => setRejecting(true)}>
                Reject…
              </Button>
            </div>
          </>
        )}
        {error ? (
          <p role="alert" className="text-bad text-sm font-medium">
            {error}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
