import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentPropsWithoutRef<"section">) {
  return (
    <section
      className={cn(
        "border-line bg-surface/90 shadow-card hover:border-gold rounded-2xl border p-5 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-hover)]",
        className,
      )}
      {...props}
    />
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
        <h2 className="text-ink font-display text-[1.19rem] leading-snug font-semibold tracking-normal">
          {title}
        </h2>
        {hint ? <p className="text-muted text-sm">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}
