import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("bg-paper-2 animate-pulse rounded-md", className)} />
  );
}

/** Loading placeholder for a page body. */
export function LoadingBlock({ label = "Loading…", rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="grid gap-3">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-8 w-1/3" />
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  );
}

/** Guided empty state: say what is missing and what to do next. */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="border-line bg-surface grid place-items-center gap-2 rounded-lg border border-dashed px-6 py-12 text-center">
      <Inbox className="text-muted size-8" aria-hidden="true" />
      <p className="text-ink font-semibold">{title}</p>
      {hint ? <p className="text-muted max-w-md text-sm">{hint}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="border-bad/40 grid place-items-center gap-2 rounded-lg border bg-[#fbeeee] px-6 py-10 text-center"
    >
      <AlertCircle className="text-bad size-8" aria-hidden="true" />
      <p className="text-ink font-semibold">{title}</p>
      {message ? <p className="text-muted max-w-md text-sm">{message}</p> : null}
      {onRetry ? (
        <Button variant="ghost" size="sm" onClick={onRetry} className="mt-2">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
