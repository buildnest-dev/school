"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { ApiError, apiRequest } from "@/lib/api/client";
import { classifyHost } from "@/server/hosts";

const noChange = () => () => {};
const fromAddress = () => {
  const q = new URLSearchParams(window.location.search).get("school");
  if (q) return q;
  const h = classifyHost(window.location.hostname);
  return h.kind === "school" || h.kind === "parents" ? h.slug : "";
};
/** The school this page is for: from the address, or ?school= on any other address. */
const useSchool = () => useSyncExternalStore(noChange, fromAddress, () => "");

const message = (e: unknown) => (e instanceof Error ? e.message : "Please try again.");

function Shell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="mx-auto grid min-h-dvh w-full max-w-lg content-center p-4">
      <Card className="grid gap-4">
        <BrandLogo />
        <CardHeader title={title} hint={hint} />
        {children}
      </Card>
    </main>
  );
}

const EMPTY = {
  studentName: "",
  dob: "",
  gender: "",
  guardianName: "",
  guardianPhone: "",
  guardianEmail: "",
};

/** A parent asks about admission. No sign-in; the school sees it under Admission enquiries. */
export function ApplyForm() {
  const school = useSchool();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setNote("");
    try {
      const body = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ""));
      const r = await apiRequest<{ message: string }>(`/public/schools/${school}/enquiries`, {
        method: "POST",
        body,
      });
      setDone(r.message);
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrors(err.fieldErrors);
      setNote(message(err));
    } finally {
      setBusy(false);
    }
  };
  const text = (key: keyof typeof EMPTY, label: string, type = "text", required = true) => (
    <Field id={`ap-${key}`} label={label} required={required} error={errors[key]?.[0]}>
      {(a) => (
        <Input
          {...a}
          type={type}
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      )}
    </Field>
  );
  return (
    <Shell title="Admission enquiry" hint="The school will contact you.">
      {done ? (
        <p role="status">{done}</p>
      ) : !school ? (
        <p>Open this page from your school’s own web address.</p>
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4">
          {text("studentName", "Child’s name")}
          {text("dob", "Date of birth", "date", false)}
          <Field id="ap-gender" label="Gender" required={false}>
            {(a) => (
              <Select
                {...a}
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
              >
                <option value="">Prefer not to say</option>
                <option value="female">Girl</option>
                <option value="male">Boy</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>
          {text("guardianName", "Parent or guardian’s name")}
          {text("guardianPhone", "Mobile number", "tel")}
          {text("guardianEmail", "Email", "email", false)}
          {note ? (
            <p role="alert" className="text-bad text-sm">
              {note}
            </p>
          ) : null}
          <div>
            <Button type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send enquiry"}
            </Button>
          </div>
        </form>
      )}
    </Shell>
  );
}

interface Check {
  valid: boolean;
  reason?: string;
  school?: string;
  title?: string;
  serialNo?: string;
  issuedOn?: string;
  student?: string;
}

/** Anyone holding a paper certificate can check that the school really issued it. */
export function VerifyForm() {
  const school = useSchool();
  const [serial, setSerial] = useState("");
  const [result, setResult] = useState<Check | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote("");
    setResult(null);
    try {
      setResult(
        await apiRequest<Check>("/public/certificates/verify", {
          query: { school, serial: serial.trim() },
        }),
      );
    } catch (err) {
      setNote(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell title="Check a certificate" hint="Type the serial number printed on the certificate.">
      {!school ? (
        <p>Open this page from the school’s own web address.</p>
      ) : (
        <form noValidate onSubmit={submit} className="grid gap-4">
          <Field id="vf-serial" label="Serial number">
            {(a) => <Input {...a} value={serial} onChange={(e) => setSerial(e.target.value)} />}
          </Field>
          <div>
            <Button type="submit" disabled={busy || !serial.trim()}>
              {busy ? "Checking…" : "Check"}
            </Button>
          </div>
          {note ? (
            <p role="alert" className="text-bad text-sm">
              {note}
            </p>
          ) : null}
          {result ? (
            <p role="status">
              {result.valid
                ? `Genuine: ${result.title} number ${result.serialNo}, issued to ${result.student} on ${result.issuedOn} by ${result.school}.`
                : result.reason === "cancelled"
                  ? `${result.school} has cancelled this certificate.`
                  : "We could not confirm a certificate with this number."}
            </p>
          ) : null}
        </form>
      )}
    </Shell>
  );
}
