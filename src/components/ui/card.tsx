import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section className={cn("border-line bg-surface rounded-lg border p-5", className)} {...props} />
  );
}

export function CardHeader({
  title,
  action,
  hint,
}: {
  title: string;
  action?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-ink font-sans text-base font-bold tracking-normal">{title}</h2>
        {hint ? <p className="text-muted text-sm">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
