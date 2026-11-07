"use client";

import { useEffect, useState, type FormEvent } from "react";
import { DevNote, PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { ApiError, apiRequest } from "@/lib/api/client";

interface Details {
  set: boolean;
  holderName?: string;
  bankName?: string;
  ifsc?: string;
  accountNumber?: string;
  upiId?: string | null;
}
const EMPTY = { holderName: "", bankName: "", ifsc: "", accountNumber: "", upiId: "" };

/**
 * The account the school's fees are paid into. Parents see these details and a UPI QR on their fees
 * page, pay the school directly, and the accountant confirms. No money passes through ZAQSA.
 */
export function PaymentDetails() {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [loaded, setLoaded] = useState(env.dataSource !== "api");
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (env.dataSource !== "api") return;
    let alive = true;
    apiRequest<Details>("/school/bank")
      .then((d) => {
        if (!alive) return;
        if (d.set)
          setForm({
            holderName: d.holderName ?? "",
            bankName: d.bankName ?? "",
            ifsc: d.ifsc ?? "",
            accountNumber: d.accountNumber ?? "",
            upiId: d.upiId ?? "",
          });
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await apiRequest("/school/bank", { method: "PUT", body: form });
      toast({ title: "Payment details saved", description: "Parents can now see them." });
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const f = (k: keyof typeof EMPTY) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value }),
  });

  return (
    <>
      <PageHeader
        title="Payment details"
        description="Where parents pay the school. Add your bank account and UPI ID; parents get a QR code to pay and upload the screenshot."
      />
      {env.dataSource !== "api" ? (
        <DevNote>Saving payment details needs the live backend.</DevNote>
      ) : !loaded ? (
        <LoadingBlock />
      ) : (
        <Card className="max-w-xl">
          <form onSubmit={save} className="grid gap-4" noValidate>
            <Field id="holder" label="Account holder name" required error={errors.holderName?.[0]}>
              {(a) => <Input {...a} autoComplete="off" {...f("holderName")} />}
            </Field>
            <Field id="bank" label="Bank name" required error={errors.bankName?.[0]}>
              {(a) => <Input {...a} autoComplete="off" {...f("bankName")} />}
            </Field>
            <Field id="acct" label="Account number" required error={errors.accountNumber?.[0]}>
              {(a) => (
                <Input {...a} inputMode="numeric" autoComplete="off" {...f("accountNumber")} />
              )}
            </Field>
            <Field id="ifsc" label="IFSC code" required error={errors.ifsc?.[0]}>
              {(a) => <Input {...a} autoComplete="off" {...f("ifsc")} />}
            </Field>
            <Field
              id="upi"
              label="UPI ID"
              hint="For example school@bank. This makes the QR code parents scan."
              error={errors.upiId?.[0]}
            >
              {(a) => <Input {...a} autoComplete="off" {...f("upiId")} />}
            </Field>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save payment details"}
            </Button>
          </form>
        </Card>
      )}
    </>
  );
}
