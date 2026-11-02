import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

const control =
  "min-h-11 w-full rounded-md border border-[#bdb5a4] bg-white px-3 text-[0.95rem] text-[#16282b] transition-colors placeholder:text-muted/70 hover:border-ink focus-visible:border-accent aria-[invalid=true]:border-bad disabled:bg-paper-2 disabled:text-muted";

export function Input({ className, ...props }: ComponentPropsWithoutRef<"input">) {
  return <input className={cn(control, className)} {...props} />;
}
export function Textarea({ className, ...props }: ComponentPropsWithoutRef<"textarea">) {
  return <textarea className={cn(control, "min-h-24 py-2.5", className)} {...props} />;
}
export function Select({ className, children, ...props }: ComponentPropsWithoutRef<"select">) {
  return (
    <select className={cn(control, className)} {...props}>
      {children}
    </select>
  );
}

/** Label + control + hint + error, wired with aria-describedby. Pass the control as a render function. */
export function Field({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode;
}) {
  const describedBy =
    [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-ink mb-1.5 block text-sm font-semibold">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-bad">
            {" "}
            *
          </span>
        ) : null}
        {required ? <span className="sr-only"> (required)</span> : null}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint ? (
        <p id={`${id}-hint`} className="text-muted mt-1 text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-bad mt-1 text-sm font-medium">
          {error}
        </p>
      ) : null}
    </div>
  );
}
