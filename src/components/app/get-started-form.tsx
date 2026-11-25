"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { demoRequestSchema, ROLE_OPTIONS, type DemoRequest } from "@/lib/schemas";

/**
 * Sign-up. Schools are not self-serve: this sends a request to the ZAQSA team (same public lead
 * endpoint as the demo form), who then set up the school and send the owner a login.
 */
export function GetStartedForm() {
  const [done, setDone] = useState(false);
  const [failed, setFailed] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequest>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: { name: "", email: "", school: "", role: ROLE_OPTIONS[0] },
  });

  const onSubmit = async (v: DemoRequest) => {
    setFailed("");
    try {
      const trap = (document.getElementById("gs-website") as HTMLInputElement | null)?.value ?? "";
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          email: v.email,
          organisation: v.school,
          productKey: "school",
          message: `Sign-up request. Role: ${v.role}`,
          website: trap,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        setFailed(
          res.status === 429
            ? "Too many requests from this device. Please try again in a few minutes."
            : (body.message ?? "Could not send your request. Please try again."),
        );
        return;
      }
      setDone(true);
      reset();
    } catch {
      setFailed("Could not reach the server. Please check your connection and try again.");
    }
  };

  if (done) {
    return (
      <div className="grid gap-4">
        <h1 className="text-[clamp(1.7rem,4vw,2.2rem)] leading-tight font-semibold">
          Request received
        </h1>
        <p className="text-muted">
          Thank you. The ZAQSA team will contact you soon to set up your school and send your login.
        </p>
        <Button asChild variant="ghost">
          <Link href="/">Back to the website</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
      <div>
        <h1 className="text-[clamp(1.7rem,4vw,2.2rem)] leading-tight font-semibold">
          Get your school started
        </h1>
        <p className="text-muted mt-1">
          Tell us about your school. We set it up for you and send the owner a login.
        </p>
      </div>
      <Field id="gs-name" label="Your name" required error={errors.name?.message}>
        {(a) => <Input {...a} autoComplete="name" {...register("name")} />}
      </Field>
      <Field id="gs-email" label="Work email" required error={errors.email?.message}>
        {(a) => <Input {...a} type="email" autoComplete="email" {...register("email")} />}
      </Field>
      <Field id="gs-school" label="School or group name" required error={errors.school?.message}>
        {(a) => <Input {...a} autoComplete="organization" {...register("school")} />}
      </Field>
      <Field id="gs-role" label="Your role">
        {(a) => (
          <Select {...a} {...register("role")}>
            {ROLE_OPTIONS.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
        )}
      </Field>
      {failed ? (
        <p role="alert" className="text-bad text-sm font-medium">
          {failed}
        </p>
      ) : null}
      <Button type="submit" block disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Request access"}
      </Button>
      <input
        id="gs-website"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
      <p className="text-muted flex flex-wrap gap-x-2 text-sm">
        Already have a login?
        <Link href="/sign-in" className="text-ink font-semibold underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </form>
  );
}
