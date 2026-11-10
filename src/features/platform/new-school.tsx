"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest } from "@/lib/api/client";

const BOARDS = ["CBSE", "ICSE", "ISC", "NIOS", "IB", "CAMBRIDGE"];
const PLANS = ["trial", "starter", "growth", "premium"];

/** The school year starts on 1 April, so before April we are still in the year that began last year. */
function currentYearLabel() {
  const d = new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

const slugFrom = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);

const empty = () => ({
  name: "",
  slug: "",
  ownerName: "",
  ownerEmail: "",
  phone: "",
  board: "CBSE",
  yearLabel: currentYearLabel(),
  plan: "trial",
});

/**
 * Creates a school: its workspace, first campus, first academic year and an owner login. The owner
 * gets an e-mail with a link to set their password. Needs the live backend.
 */
export function NewSchool({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const set = (k: keyof ReturnType<typeof empty>, v: string) =>
    setForm((f) => ({
      ...f,
      [k]: v,
      ...(k === "name" && !slugTouched ? { slug: slugFrom(v) } : {}),
    }));
  const bind = (k: keyof ReturnType<typeof empty>) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      await apiRequest("/platform/schools", {
        method: "POST",
        body: {
          name: form.name,
          slug: form.slug,
          ownerName: form.ownerName,
          ownerEmail: form.ownerEmail,
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          boardCodes: [form.board],
          yearLabel: form.yearLabel,
          plan: form.plan,
        },
      });
      toast({
        title: "School created",
        description: `An e-mail with a password link was sent to ${form.ownerEmail}.`,
      });
      setOpen(false);
      setForm(empty());
      setSlugTouched(false);
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast({
        title: "Couldn’t create the school",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>New school</Button>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="New school"
        description="Creates the school's workspace and e-mails its owner a link to set a password."
      >
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <Field id="ns-name" label="School name" required error={errors.name?.[0]}>
            {(a) => <Input {...a} autoComplete="off" {...bind("name")} />}
          </Field>
          <Field
            id="ns-slug"
            label="Address name"
            required
            hint={`Becomes ${form.slug || "name"}.school.zaqsa.com. Lowercase letters, digits and hyphens.`}
            error={errors.slug?.[0]}
          >
            {(a) => (
              <Input
                {...a}
                autoComplete="off"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  set("slug", e.target.value.toLowerCase());
                }}
              />
            )}
          </Field>
          <Field id="ns-owner" label="Owner's name" required error={errors.ownerName?.[0]}>
            {(a) => <Input {...a} autoComplete="off" {...bind("ownerName")} />}
          </Field>
          <Field id="ns-email" label="Owner's e-mail" required error={errors.ownerEmail?.[0]}>
            {(a) => <Input {...a} type="email" autoComplete="off" {...bind("ownerEmail")} />}
          </Field>
          <Field id="ns-phone" label="Phone" error={errors.phone?.[0]}>
            {(a) => <Input {...a} inputMode="tel" autoComplete="off" {...bind("phone")} />}
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ns-board" label="Board" error={errors.boardCodes?.[0]}>
              {(a) => (
                <Select {...a} {...bind("board")}>
                  {BOARDS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field id="ns-year" label="First year" error={errors.yearLabel?.[0]}>
              {(a) => <Input {...a} autoComplete="off" {...bind("yearLabel")} />}
            </Field>
            <Field id="ns-plan" label="Plan" error={errors.plan?.[0]}>
              {(a) => (
                <Select {...a} {...bind("plan")}>
                  {PLANS.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create school"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
