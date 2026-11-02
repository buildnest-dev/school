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
 * Demo request form. Validation runs in the browser only: there is no backend endpoint yet, and the UI
 * says so. Wire `onSubmit` to a real form service or API route before going live.
 */
export function DemoForm() {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DemoRequest>({
    resolver: zodResolver(demoRequestSchema),
    defaultValues: { name: "", email: "", school: "", role: ROLE_OPTIONS[0] },
  });

  const onSubmit = async () => {
    // Placeholder: nothing is sent. Replace with a call to the real endpoint when it exists.
    await new Promise((r) => setTimeout(r, 350));
    setDone(true);
    reset();
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
        {isSubmitting ? "Checking…" : "Send request"}
      </Button>
      <p
        role="status"
        aria-live="polite"
        className={cn("min-h-[1.2em] text-[0.9rem] text-[#bfe8cf]")}
      >
        {done
          ? "Looks good. Nothing was sent: connect a form backend to receive real requests."
          : ""}
      </p>
      <p className="text-on-dark text-[0.78rem]">
        Demo form only: submitting is checked in your browser and is not sent anywhere. A configured
        backend or form service is needed before real requests can be received.
      </p>
    </form>
  );
}
