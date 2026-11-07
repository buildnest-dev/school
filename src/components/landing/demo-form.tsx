"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { demoRequestSchema, ROLE_OPTIONS, type DemoRequest } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const inputClass =
  "min-h-[46px] w-full rounded-sm border border-[#5d7b7e] bg-ink px-3 text-white transition-colors hover:border-on-dark focus-visible:border-accent-light focus-visible:outline-accent-light aria-[invalid=true]:border-[#ff9d9d]";

/**
 * Demo request form. It checks the fields in the browser, then sends them to the public lead
 * endpoint, which stores a new lead for the ZAQSA team. The endpoint limits how often one address
 * can send, and the hidden "website" field is a trap for bots: people never fill it in.
 */
export function DemoForm() {
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
      const trap =
        (document.getElementById("demo-website") as HTMLInputElement | null)?.value ?? "";
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: v.name,
          email: v.email,
          organisation: v.school,
          productKey: "school",
          message: `Role: ${v.role}`,
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

  const field = (name: keyof DemoRequest, label: string, type = "text", autoComplete?: string) => (
    <div>
      <label htmlFor={`demo-${name}`} className="mb-1.5 block text-sm font-semibold text-white">
        {label}
      </label>
      <input
        id={`demo-${name}`}
        type={type}
        autoComplete={autoComplete}
        aria-invalid={errors[name] ? true : undefined}
        aria-describedby={errors[name] ? `demo-${name}-err` : undefined}
        className={inputClass}
        {...register(name)}
      />
      {errors[name] ? (
        <p id={`demo-${name}-err`} className="mt-1.5 text-[0.82rem] text-[#ffb4b4]">
          {errors[name]?.message}
        </p>
      ) : null}
    </div>
  );

  return (
    <form
      id="demo-form"
      noValidate
      aria-labelledby="demo-form-title"
      onSubmit={handleSubmit(onSubmit)}
      className="bg-ink-2 border-ink-line grid gap-4 rounded-[10px] border p-6 lg:p-8"
    >
      <h3 id="demo-form-title" className="text-[1.4rem] text-white">
        Request a demo
      </h3>
      {field("name", "Your name", "text", "name")}
      {field("email", "Work email", "email", "email")}
      {field("school", "School or group name", "text", "organization")}
      <div>
        <label htmlFor="demo-role" className="mb-1.5 block text-sm font-semibold text-white">
          Your role
        </label>
        <select id="demo-role" className={inputClass} {...register("role")}>
          {ROLE_OPTIONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>
      <Button type="submit" variant="light" block disabled={isSubmitting}>
        {isSubmitting ? "Sending…" : "Send request"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={cn("min-h-[1.2em] text-[0.9rem] text-[#bfe8cf]")}
      >
        {done ? "Thank you. The ZAQSA team will contact you soon." : ""}
      </p>
      {failed ? (
        <p role="alert" className="text-[0.9rem] text-[#ffb4b4]">
          {failed}
        </p>
      ) : null}
      <input
        id="demo-website"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />
    </form>
  );
}
