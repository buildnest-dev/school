"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest } from "@/lib/api/client";

export interface QuickField {
  key: string;
  label: string;
  type?: "text" | "date" | "number" | "select" | "textarea";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
}

/**
 * A small "add one record" dialog: a button, a form built from `fields`, one POST. Used by the
 * school screens that only need a few plain fields (calendar, vendors, events, datesheet).
 */
export function QuickAdd({
  label,
  title,
  description,
  endpoint,
  fields,
  onCreated,
  method = "POST",
  variant,
}: {
  method?: "POST" | "PATCH";
  variant?: "ghost" | "primary";
  label: string;
  title: string;
  description?: string;
  endpoint: string;
  fields: QuickField[];
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const initial = () =>
    Object.fromEntries(fields.map((f) => [f.key, f.type === "select" ? (f.options?.[0]?.value ?? "") : ""]));
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      // A blank optional text box is left out, so the server does not read "" as a bad value.
      const body = Object.fromEntries(
        fields
          .filter((f) => f.required !== false || f.type === "number" || form[f.key] !== "")
          .map((f) => [f.key, f.type === "number" ? Number(form[f.key] || 0) : form[f.key]]),
      );
      await apiRequest(endpoint, { method, body });
      toast({ title: "Saved", description: title });
      setOpen(false);
      setForm(initial());
      onCreated();
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

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title={title}
        description={description}
      >
        <form onSubmit={submit} className="grid gap-4" noValidate>
          {fields.map((f) => (
            <Field
              key={f.key}
              id={`qa-${f.key}`}
              label={f.label}
              required={f.required !== false}
              error={errors[f.key]?.[0]}
            >
              {(a) =>
                f.type === "select" ? (
                  <Select
                    {...a}
                    value={form[f.key]}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  >
                    {f.options?.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                ) : f.type === "textarea" ? (
                  <Textarea
                    {...a}
                    rows={3}
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    {...a}
                    type={f.type ?? "text"}
                    autoComplete="off"
                    value={form[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  />
                )
              }
            </Field>
          ))}
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** One button that calls the backend (PATCH, POST or DELETE) and then refreshes the screen. */
export function ApiAction({
  label,
  method,
  endpoint,
  body,
  variant = "ghost",
  onDone,
}: {
  label: string;
  method: "PATCH" | "POST" | "DELETE";
  endpoint: string;
  body?: unknown;
  variant?: "ghost" | "primary";
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await apiRequest(endpoint, { method, body });
      onDone();
    } catch (err) {
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button variant={variant} onClick={run} disabled={busy}>
      {busy ? "Saving…" : label}
    </Button>
  );
}
