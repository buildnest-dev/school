"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api/client";
import { rupees } from "../shared/format";
import { QuickAdd } from "../shared/quick-add";

const MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "cheque", label: "Cheque" },
  { value: "dd", label: "Demand draft" },
  { value: "netbanking", label: "Net banking" },
  { value: "card", label: "Card" },
];

/** Writes down money the school has received against one invoice. */
export function RecordPayment({
  invoiceId,
  balance,
  done,
}: {
  invoiceId: string;
  balance: number;
  done: () => void;
}) {
  return (
    <QuickAdd
      label="Record payment"
      title="Record a payment"
      description={`Balance due: ${rupees(balance)}. This only records money already received.`}
      endpoint={`/fees/invoices/${invoiceId}/payments`}
      fields={[
        { key: "amountRupees", label: "Amount received (Rs)", type: "number" },
        { key: "mode", label: "Paid by", type: "select", options: MODES },
        { key: "reference", label: "Reference (needed unless cash)", required: false },
      ]}
      values={{ amountRupees: String(balance) }}
      onCreated={done}
    />
  );
}

interface Summary {
  overdueInvoices: number;
  recentlyReminded: number;
  guardiansToEmail: number;
  withoutEmail: number;
  sent?: number;
}

/** E-mails parents about overdue fees, after showing who will get one. */
export function FeeReminders() {
  const { toast } = useToast();
  const [plan, setPlan] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (dryRun: boolean) => {
    setBusy(true);
    try {
      const r = await apiRequest<Summary>("/fees/reminders", { method: "POST", body: { dryRun } });
      if (dryRun) setPlan(r);
      else {
        setPlan(null);
        toast({ title: "Reminders sent", description: `${r.sent ?? 0} parents e-mailed.` });
      }
    } catch (e) {
      toast({
        title: "Couldn’t send reminders",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="ghost" onClick={() => run(true)} disabled={busy}>
        Fee reminders
      </Button>
      <Dialog
        open={plan !== null}
        onOpenChange={(o) => !o && !busy && setPlan(null)}
        title="Send fee reminders"
      >
        {plan ? (
          <div className="grid gap-3 text-sm">
            <p>
              {plan.overdueInvoices} overdue invoices. {plan.guardiansToEmail} parents will get an
              e-mail. {plan.recentlyReminded} were reminded in the last week and {plan.withoutEmail}{" "}
              have no e-mail address.
            </p>
            <div>
              <Button onClick={() => run(false)} disabled={busy || !plan.guardiansToEmail}>
                {busy ? "Sending…" : "Send e-mails"}
              </Button>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

/** Asks for money to be returned; the owner or principal approves it on the Refunds screen. */
export function RequestRefund({ paymentId, done }: { paymentId: string; done: () => void }) {
  return (
    <QuickAdd
      label="Ask refund"
      title="Ask for a refund"
      variant="ghost"
      endpoint={`/fees/payments/${paymentId}/refunds`}
      fields={[
        { key: "amount", label: "Amount (Rs)", type: "number" },
        { key: "reason", label: "Reason (at least 5 letters)", type: "textarea" },
      ]}
      onCreated={done}
    />
  );
}
