"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { ApiError, apiRequest } from "@/lib/api/client";

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

const empty = () => ({
  name: "",
  dob: "",
  gender: "male",
  sectionId: "",
  guardianName: "",
  relation: "father",
  phone: "",
  email: "",
  login: true,
});

/**
 * Adds a student with the guardian, and optionally gives the guardian a parent login (an e-mail
 * invite). A school with no classes yet first creates the standard ones (Nursery to Class 12).
 */
export function AddStudent({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const loadClasses = () =>
    apiRequest<ClassRow[]>("/classes")
      .then(setClasses)
      .catch(() => setClasses([]));
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void loadClasses(), 0);
    return () => clearTimeout(t);
  }, [open]);

  const set = (k: keyof ReturnType<typeof empty>, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));
  const bind = (k: Exclude<keyof ReturnType<typeof empty>, "login">) => ({
    value: form[k],
    onChange: (e: { target: { value: string } }) => set(k, e.target.value),
  });

  const setupClasses = async () => {
    setBusy(true);
    try {
      await apiRequest("/classes/standard", { method: "POST", body: {} });
      await loadClasses();
      toast({ title: "Classes created", description: "Nursery to Class 12, section A." });
    } catch (err) {
      toast({
        title: "Couldn’t create the classes",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const email = form.email.trim();
      const r = await apiRequest<{ id: string }>("/students", {
        method: "POST",
        body: {
          name: form.name,
          dob: form.dob,
          gender: form.gender,
          sectionId: form.sectionId,
          guardian: {
            name: form.guardianName,
            relation: form.relation,
            phone: form.phone,
            ...(email ? { email } : {}),
          },
        },
      });
      let note = "Student added.";
      if (form.login && email) {
        try {
          await apiRequest(`/students/${r.id}/guardian-login`, { method: "POST", body: {} });
          note = `Student added. A password link was e-mailed to ${email}.`;
        } catch (err) {
          note = `Student added, but the parent login failed: ${err instanceof Error ? err.message : "try again from the student page"}`;
        }
      }
      toast({ title: "Done", description: note });
      setOpen(false);
      setForm(empty());
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      toast({
        title: "Couldn’t add the student",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const fe = (k: string) => errors[k]?.[0] ?? errors[`guardian.${k}`]?.[0];

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add student</Button>
      <Dialog
        open={open}
        onOpenChange={(o) => !busy && setOpen(o)}
        title="Add student"
        description="Adds the student to a class and records the guardian."
      >
        {classes && classes.length === 0 ? (
          <div className="grid gap-3">
            <p className="text-sm">
              This school has no classes yet. Create the standard ones (Nursery to Class 12, section
              A) to start. You can add more sections later.
            </p>
            <div>
              <Button onClick={setupClasses} disabled={busy}>
                {busy ? "Creating…" : "Create classes"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4" noValidate>
            <Field id="as-name" label="Student's name" required error={fe("name")}>
              {(a) => <Input {...a} autoComplete="off" {...bind("name")} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="as-dob" label="Date of birth" required error={fe("dob")}>
                {(a) => <Input {...a} type="date" {...bind("dob")} />}
              </Field>
              <Field id="as-gender" label="Gender" error={fe("gender")}>
                {(a) => (
                  <Select {...a} {...bind("gender")}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                )}
              </Field>
            </div>
            <Field id="as-section" label="Class and section" required error={fe("sectionId")}>
              {(a) => (
                <Select {...a} {...bind("sectionId")}>
                  <option value="">Choose</option>
                  {(classes ?? []).flatMap((c) =>
                    c.sections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {c.name} · {s.name}
                      </option>
                    )),
                  )}
                </Select>
              )}
            </Field>
            <Field id="as-guardian" label="Guardian's name" required error={fe("name")}>
              {(a) => <Input {...a} autoComplete="off" {...bind("guardianName")} />}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="as-relation" label="Relation" error={fe("relation")}>
                {(a) => (
                  <Select {...a} {...bind("relation")}>
                    <option value="father">Father</option>
                    <option value="mother">Mother</option>
                    <option value="guardian">Guardian</option>
                  </Select>
                )}
              </Field>
              <Field id="as-phone" label="Mobile number" required error={fe("phone")}>
                {(a) => <Input {...a} inputMode="tel" autoComplete="off" {...bind("phone")} />}
              </Field>
            </div>
            <Field id="as-email" label="Guardian's e-mail" error={fe("email")}>
              {(a) => <Input {...a} type="email" autoComplete="off" {...bind("email")} />}
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.login}
                onChange={(e) => set("login", e.target.checked)}
              />
              Give the guardian a parent login (needs the e-mail)
            </label>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy || !form.name || !form.sectionId}>
                {busy ? "Adding…" : "Add student"}
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}
