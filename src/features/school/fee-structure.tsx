"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/hooks/use-session";
import { ApiError, apiRequest } from "@/lib/api/client";
import { rupees } from "../shared/format";

interface Head {
  id: string;
  name: string;
  gstPercent: number;
}
interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
interface Summary {
  matched: number;
  skipped: number;
  toCreate: number;
  totalPayable: number;
  totalDiscount: number;
}

const BLANK = {
  target: "",
  title: "",
  amount: "",
  dueOn: "",
  discountPercent: "",
  discountReason: "",
  siblingDiscountPercent: "",
};

/**
 * Fee heads (the kinds of fee the school charges) and raising a fee for a whole class or section.
 * The amount is entered when the fee is raised; students who already have that fee this year are
 * skipped, so raising it twice never bills anyone twice.
 */
export function FeeStructure() {
  const { toast } = useToast();
  const { user } = useSession();
  const canAddHead = user?.role === "school_owner" || user?.role === "principal";
  const [heads, setHeads] = useState<Head[] | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [headName, setHeadName] = useState("");
  const [headGst, setHeadGst] = useState("0");
  const [headBusy, setHeadBusy] = useState(false);
  const [headErrors, setHeadErrors] = useState<Record<string, string[]>>({});

  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([
        apiRequest<{ items: Head[] }>("/fees/heads"),
        apiRequest<ClassRow[]>("/classes"),
      ]);
      setHeads(h.items);
      setClasses(c);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load.");
    }
  }, []);
  useEffect(() => {
    // Deferred so the first state update is not synchronous inside the effect.
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  const addHead = async (e: FormEvent) => {
    e.preventDefault();
    setHeadBusy(true);
    setHeadErrors({});
    try {
      await apiRequest("/fees/heads", {
        method: "POST",
        body: { name: headName, gstPercent: Number(headGst || 0) },
      });
      setHeadName("");
      setHeadGst("0");
      toast({ title: "Fee head added" });
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setHeadErrors(err.fieldErrors);
      toast({
        title: "Couldn’t add it",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setHeadBusy(false);
    }
  };

  const set = (k: keyof typeof BLANK, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSummary(null);
  };
  const bind = (k: keyof typeof BLANK) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  const run = async (preview: boolean) => {
    setBusy(true);
    setErrors({});
    try {
      const [kind, id] = form.target.split(":");
      const r = await apiRequest<Summary & { created?: number }>("/fees/invoices/generate", {
        method: "POST",
        body: {
          ...(kind === "c" ? { classId: id } : { sectionId: id }),
          title: form.title.trim(),
          amount: Number(form.amount),
          dueOn: form.dueOn,
          discountPercent: Number(form.discountPercent || 0),
          ...(form.discountReason.trim() ? { discountReason: form.discountReason.trim() } : {}),
          siblingDiscountPercent: Number(form.siblingDiscountPercent || 0),
          preview,
        },
      });
      if (preview) setSummary(r);
      else {
        toast({
          title: "Fee raised",
          description: `${r.created ?? r.toCreate} invoices created.`,
        });
        setSummary(null);
        setForm(BLANK);
      }
    } catch (err) {
      setSummary(null);
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast({
        title: preview ? "Couldn’t check" : "Couldn’t raise the fee",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const ready =
    form.target && form.title.trim().length >= 2 && Number(form.amount) > 0 && form.dueOn;

  return (
    <>
      <PageHeader
        title="Fee structure"
        description="The kinds of fee your school charges, and raising a fee for a whole class or section."
      />
      {loadError ? (
        <p role="alert" className="text-bad text-sm font-medium">
          {loadError}
        </p>
      ) : !heads ? (
        <LoadingBlock />
      ) : (
        <div className="grid max-w-3xl gap-6">
          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold">Fee heads</h2>
            {heads.length === 0 ? (
              <p className="text-muted text-sm">
                No fee heads yet. Add the kinds of fee you charge, such as Tuition, Transport or
                Exam fee.
              </p>
            ) : (
              <ul className="divide-line divide-y text-sm">
                {heads.map((h) => (
                  <li key={h.id} className="flex justify-between py-2">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted">
                      {h.gstPercent ? `GST ${h.gstPercent}%` : "No GST"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {canAddHead ? (
              <form
                onSubmit={addHead}
                className="grid gap-3 sm:grid-cols-[1fr_8rem_auto] sm:items-end"
                noValidate
              >
                <Field id="fh-name" label="New fee head" error={headErrors.name?.[0]}>
                  {(a) => (
                    <Input
                      {...a}
                      autoComplete="off"
                      placeholder="Tuition"
                      value={headName}
                      onChange={(e) => setHeadName(e.target.value)}
                    />
                  )}
                </Field>
                <Field id="fh-gst" label="GST %" error={headErrors.gstPercent?.[0]}>
                  {(a) => (
                    <Input
                      {...a}
                      inputMode="numeric"
                      value={headGst}
                      onChange={(e) => setHeadGst(e.target.value)}
                    />
                  )}
                </Field>
                <Button type="submit" disabled={headBusy || headName.trim().length < 2}>
                  {headBusy ? "Adding…" : "Add"}
                </Button>
              </form>
            ) : (
              <p className="text-muted text-sm">The principal or owner adds new fee heads.</p>
            )}
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-lg font-semibold">Raise a fee</h2>
            <p className="text-muted text-sm">
              Creates an invoice for every active student of the class or section you choose.
              Students who already have a fee with the same title this year are skipped. Check the
              totals first; nothing is saved until you press Raise fee.
            </p>
            {classes.length === 0 ? (
              <p className="text-sm">
                This school has no classes yet. Add classes first, then come back here.
              </p>
            ) : (
              <div className="grid gap-4">
                <Field
                  id="rf-target"
                  label="Who is it for?"
                  required
                  error={errors.sectionId?.[0] ?? errors.classId?.[0]}
                >
                  {(a) => (
                    <Select {...a} {...bind("target")}>
                      <option value="">Choose a class or section</option>
                      {classes.map((c) => (
                        <optgroup key={c.id} label={c.name}>
                          <option value={`c:${c.id}`}>Whole {c.name}</option>
                          {c.sections.map((s) => (
                            <option key={s.id} value={`s:${s.id}`}>
                              {c.name} · {s.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  )}
                </Field>
                <Field
                  id="rf-title"
                  label="Fee title"
                  required
                  hint="For example: Tuition term 1. The same title is never billed twice to a student."
                  error={errors.title?.[0]}
                >
                  {(a) => (
                    <>
                      <Input {...a} list="rf-heads" autoComplete="off" {...bind("title")} />
                      <datalist id="rf-heads">
                        {heads.map((h) => (
                          <option key={h.id} value={h.name} />
                        ))}
                      </datalist>
                    </>
                  )}
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    id="rf-amount"
                    label="Amount per student (₹)"
                    required
                    error={errors.amount?.[0]}
                  >
                    {(a) => (
                      <Input {...a} inputMode="decimal" autoComplete="off" {...bind("amount")} />
                    )}
                  </Field>
                  <Field id="rf-due" label="Due date" required error={errors.dueOn?.[0]}>
                    {(a) => <Input {...a} type="date" {...bind("dueOn")} />}
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field id="rf-disc" label="Concession %" error={errors.discountPercent?.[0]}>
                    {(a) => (
                      <Input
                        {...a}
                        inputMode="decimal"
                        placeholder="0"
                        {...bind("discountPercent")}
                      />
                    )}
                  </Field>
                  <Field
                    id="rf-reason"
                    label="Concession reason"
                    error={errors.discountReason?.[0]}
                  >
                    {(a) => <Input {...a} autoComplete="off" {...bind("discountReason")} />}
                  </Field>
                  <Field
                    id="rf-sib"
                    label="Sibling extra %"
                    error={errors.siblingDiscountPercent?.[0]}
                  >
                    {(a) => (
                      <Input
                        {...a}
                        inputMode="decimal"
                        placeholder="0"
                        {...bind("siblingDiscountPercent")}
                      />
                    )}
                  </Field>
                </div>
                {summary ? (
                  <p role="status" className="text-sm">
                    {summary.matched} active students. {summary.toCreate} will get this fee
                    {summary.skipped ? `, ${summary.skipped} already have it` : ""}. Total payable{" "}
                    {rupees(summary.totalPayable)}
                    {summary.totalDiscount ? `, concessions ${rupees(summary.totalDiscount)}` : ""}.
                  </p>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" disabled={busy || !ready} onClick={() => run(true)}>
                    Check totals
                  </Button>
                  <Button
                    disabled={busy || !ready || !summary || summary.toCreate === 0}
                    onClick={() => run(false)}
                  >
                    {busy ? "Working…" : "Raise fee"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
