"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DevNote, PageHeader, useUnsavedWarning } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env, todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { STAFF_SCHOOL_AUDIENCES, SCHOOL_NAME } from "@/mocks/data";
import type { CertificateType } from "@/types";
import { fmtDate } from "../shared/format";

const noticeSchema = z.object({
  title: z.string().trim().min(4, "Give the notice a clear title."),
  audience: z.string().min(1, "Choose who should receive it."),
  body: z.string().trim().min(10, "Write the notice (at least a sentence)."),
});
type NoticeForm = z.infer<typeof noticeSchema>;

/** Compose, choose audience, preview. Publishing is a mock until the backend sends real notifications. */
export function NoticeNew() {
  const s = useServices();
  const router = useRouter();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    control,
    trigger,
    getValues,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NoticeForm>({
    resolver: zodResolver(noticeSchema),
    defaultValues: { title: "", audience: "", body: "" },
  });
  const w = useWatch({ control });
  useUnsavedWarning(isDirty && !isSubmitting);
  const save = async (publish: boolean) => {
    if (!(await trigger())) return;
    try {
      const res = await s.notices.create({ ...getValues(), publish });
      toast({ title: publish ? "Notice published" : "Draft saved", description: res.message });
      router.push("/school/notices");
    } catch (e) {
      toast({
        title: "Couldn’t save the notice",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <>
      <PageHeader
        title="Compose notice"
        description="Write it, choose who receives it, and check the preview."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <form
          noValidate
          onSubmit={handleSubmit(() => save(true))}
          className="grid content-start gap-5"
        >
          <Field id="nt-title" label="Title" required error={errors.title?.message}>
            {(a) => <Input {...a} {...register("title")} />}
          </Field>
          <Field id="nt-aud" label="Who should get it?" required error={errors.audience?.message}>
            {(a) => (
              <Select {...a} {...register("audience")}>
                <option value="">Choose an audience</option>
                {STAFF_SCHOOL_AUDIENCES.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="nt-body" label="Message" required error={errors.body?.message}>
            {(a) => <Textarea className="min-h-40" {...a} {...register("body")} />}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
              Publish notice
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={isSubmitting}
              onClick={() => save(false)}
              className="min-h-12"
            >
              Save as draft
            </Button>
            <Button asChild variant="ghost" className="min-h-12">
              <Link href="/school/notices">Cancel</Link>
            </Button>
          </div>
          <DevNote>
            Publishing here does not send anything. Email, SMS and push need providers connected on
            the backend.
          </DevNote>
        </form>
        <Card aria-label="Preview" className="self-start">
          <CardHeader
            title="Preview"
            hint={w.audience ? `For: ${w.audience}` : "Choose an audience"}
          />
          <p className="font-display text-ink text-xl">{w.title || "Notice title"}</p>
          <p className="text-muted mt-2 text-sm whitespace-pre-wrap">
            {w.body || "Your message appears here."}
          </p>
        </Card>
      </div>
    </>
  );
}

const ALL_CERT_TYPES: CertificateType[] = [
  "Bonafide",
  "Transfer",
  "Character",
  "Study",
  "School leaving",
];
/** The real backend issues bonafide, transfer and character certificates only. */
const CERT_TYPES: CertificateType[] =
  env.dataSource === "api" ? ["Bonafide", "Transfer", "Character"] : ALL_CERT_TYPES;
const certSchema = z.object({
  type: z.enum(["Bonafide", "Transfer", "Character", "Study", "School leaving"]),
  studentId: z.string().min(1, "Choose a student."),
  purpose: z.string().trim().min(3, "Say what the certificate is for."),
});
type CertForm = z.infer<typeof certSchema>;

function certBody(type: CertificateType, name: string, cls: string, purpose: string) {
  switch (type) {
    case "Bonafide":
      return `This is to certify that ${name}, Class ${cls}, is a bonafide student of ${SCHOOL_NAME} for the academic year 2026–27. This certificate is issued for: ${purpose}.`;
    case "Transfer":
      return `This is to certify that ${name}, last studying in Class ${cls}, has been granted a transfer from ${SCHOOL_NAME}. Dues and conduct are as recorded in the school register.`;
    case "Character":
      return `This is to certify that ${name}, Class ${cls}, has been a student of ${SCHOOL_NAME} and, to the best of the school’s knowledge, bears a good character. Issued for: ${purpose}.`;
    case "Study":
      return `This is to certify that ${name} has studied at ${SCHOOL_NAME} and is currently in Class ${cls}. Issued for: ${purpose}.`;
    default:
      return `This is to certify that ${name} has completed the course of study at ${SCHOOL_NAME} (last class: ${cls}).`;
  }
}

/** Prepare a certificate request and preview the wording. No PDF is generated and no certificate is issued. */
export function CertificateNew() {
  const s = useServices();
  const router = useRouter();
  const { toast } = useToast();
  const students = useAsync(
    () => s.resource("students").list({ pageSize: 60, sort: "name", order: "asc" }),
    [s],
  );
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CertForm>({
    resolver: zodResolver(certSchema),
    defaultValues: { type: "Bonafide", studentId: "", purpose: "" },
  });
  const w = useWatch({ control });
  const stu = students.data?.items.find((x) => x.id === w.studentId);
  const onSubmit = async (v: CertForm) => {
    try {
      const res = await s.certificates.create(v);
      toast({ title: "Certificate request created", description: res.message });
      router.push("/school/certificates");
    } catch (e) {
      toast({
        title: "Couldn’t create the request",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  if (students.error)
    return <ErrorState message={students.error.message} onRetry={students.reload} />;
  if (!students.data) return <LoadingBlock />;
  return (
    <>
      <PageHeader
        title="Generate certificate"
        description="Choose the certificate and the student, check the wording, then send it for approval."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid content-start gap-5">
          <Field id="ct-type" label="Certificate">
            {(a) => (
              <Select {...a} {...register("type")}>
                {CERT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="ct-student" label="Student" required error={errors.studentId?.message}>
            {(a) => (
              <Select {...a} {...register("studentId")}>
                <option value="">Choose a student</option>
                {students.data!.items.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} · {x.classSection}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            id="ct-purpose"
            label="Purpose"
            required
            error={errors.purpose?.message}
            hint="For example: bank account, passport, scholarship"
          >
            {(a) => <Input {...a} {...register("purpose")} />}
          </Field>
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
              Send for approval
            </Button>
            <Button asChild variant="ghost" className="min-h-12">
              <Link href="/school/certificates">Cancel</Link>
            </Button>
          </div>
          <DevNote>
            This only creates a request in the development mock. Certificate numbers, signatures,
            PDF generation and the no-dues check are done by the backend.
          </DevNote>
        </form>
        <div
          className="relative overflow-hidden rounded-lg border-2 border-double border-[#bdb5a4] bg-white p-8"
          aria-label="Certificate preview"
        >
          <p
            aria-hidden="true"
            className="text-ink/5 pointer-events-none absolute inset-0 grid -rotate-12 place-items-center text-6xl font-bold tracking-widest select-none"
          >
            PREVIEW
          </p>
          <p className="text-muted text-center text-xs tracking-widest uppercase">{SCHOOL_NAME}</p>
          <h2 className="font-display mt-2 text-center text-2xl">
            {w.type ?? "Bonafide"} Certificate
          </h2>
          <p className="mt-6 text-sm leading-relaxed">
            {stu
              ? certBody(
                  (w.type ?? "Bonafide") as CertificateType,
                  stu.name,
                  stu.classSection,
                  w.purpose?.trim() || "the stated purpose",
                )
              : "Choose a student to see the wording."}
          </p>
          <div className="mt-10 flex justify-between text-xs">
            <span>Date: {fmtDate(todayIso())}</span>
            <span>Certificate no.: assigned on issue</span>
          </div>
          <p className="text-muted mt-6 text-xs">
            Preview only. Not a valid certificate. Authorized signature and verification code are
            added by the backend.
          </p>
        </div>
      </div>
    </>
  );
}

export function CertificateVerify() {
  const s = useServices();
  const [no, setNo] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "valid" | "invalid" | "error">("idle");
  const [summary, setSummary] = useState("");
  const [fieldErr, setFieldErr] = useState("");
  const check = async () => {
    if (!no.trim()) {
      setFieldErr("Enter the certificate number.");
      return;
    }
    setFieldErr("");
    setState("loading");
    try {
      const r = await s.certificates.verify(no);
      setSummary(r.summary ?? "");
      setState(r.valid ? "valid" : "invalid");
    } catch {
      setState("error");
    }
  };
  return (
    <>
      <PageHeader
        title="Verify a certificate"
        description="Enter a certificate number to check it. Only the minimum details are shown."
      />
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void check();
        }}
        className="grid max-w-md gap-4"
      >
        <Field
          id="verify-no"
          label="Certificate number"
          error={fieldErr}
          hint="Try NA/BON/2026/0142 (sample)"
        >
          {(a) => <Input value={no} onChange={(e) => setNo(e.target.value)} {...a} />}
        </Field>
        <div>
          <Button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "Checking…" : "Check"}
          </Button>
        </div>
      </form>
      <div className="mt-5 max-w-md" aria-live="polite">
        {state === "valid" ? (
          <p className="border-ok/50 rounded-lg border bg-[#e3f1ea] p-4 text-[#1d5a41]">
            <strong>Valid.</strong> {summary}
          </p>
        ) : null}
        {state === "invalid" ? (
          <p className="border-bad/40 rounded-lg border bg-[#fbeeee] p-4 text-[#8a2b2b]">
            <strong>Not found or cancelled.</strong> This number doesn’t match an active
            certificate.
          </p>
        ) : null}
        {state === "error" ? (
          <ErrorState message="The check failed. Please try again." onRetry={() => void check()} />
        ) : null}
      </div>
      <div className="mt-5 max-w-md">
        <DevNote>
          Public verification (without signing in) and QR codes are backend features. This checks
          the development mock register.
        </DevNote>
      </div>
    </>
  );
}
