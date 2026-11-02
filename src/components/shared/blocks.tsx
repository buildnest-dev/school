"use client";

import { ChevronLeft, ChevronRight, FlaskConical, Upload } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AuditEntry, CalendarEvent, Stat } from "@/types";

/** Page title, description and contextual actions. Every screen starts with one. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow ? (
          <p className="text-accent-ink mb-1 text-xs font-semibold tracking-widest uppercase">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-[clamp(1.6rem,3vw,2.1rem)] leading-tight">{title}</h1>
        {description ? <p className="text-muted mt-1 max-w-[62ch]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="border-line bg-surface rounded-lg border p-4">
          <dt className="text-muted text-xs font-semibold tracking-wide uppercase">{s.label}</dt>
          <dd className="font-display text-ink mt-1 text-[1.75rem] leading-tight tabular-nums">
            {s.value}
          </dd>
          {s.hint ? <dd className="text-muted text-xs">{s.hint}</dd> : null}
        </div>
      ))}
    </dl>
  );
}

/** Horizontal bars with the value written out (never colour alone). */
export function BarList({ rows }: { rows: { label: string; pct: number; text?: string }[] }) {
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[110px_1fr_48px] items-center gap-3 text-sm">
          <span>{r.label}</span>
          <span className="bg-paper-2 block h-2 overflow-hidden rounded-full">
            <span
              className="bg-ink-2 block h-full rounded-full"
              style={{ width: `${Math.min(100, r.pct)}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">{r.text ?? `${r.pct}%`}</span>
        </li>
      ))}
    </ul>
  );
}

/** Explains that a result came from the development mock, not a server. */
export function DevNote({ children }: { children: ReactNode }) {
  return (
    <p className="border-warn/40 flex items-start gap-2 rounded-md border bg-[#fbf3e1] px-3 py-2 text-sm text-[#6b4306]">
      <FlaskConical className="mt-0.5 size-4 flex-none" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

/** Multi-step progress indicator. */
export function Stepper({
  steps,
  current,
  onSelect,
}: {
  steps: string[];
  current: number;
  onSelect?: (i: number) => void;
}) {
  return (
    <ol className="grid gap-2 sm:grid-cols-3 lg:grid-cols-9" aria-label="Progress">
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        return (
          <li key={s} aria-current={state === "current" ? "step" : undefined}>
            <button
              type="button"
              disabled={!onSelect || i > current}
              onClick={() => onSelect?.(i)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition-colors",
                state === "current" && "border-ink bg-ink text-white",
                state === "done" && "border-ok/50 bg-[#e3f1ea] text-[#1d5a41] hover:bg-[#d4eadf]",
                state === "todo" && "border-line bg-surface text-muted",
              )}
            >
              <span className="grid size-5 flex-none place-items-center rounded-full border text-[0.65rem]">
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className="leading-tight">{s}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Development file picker: shows the chosen file name; nothing is uploaded anywhere. */
export function FileUpload({ label, hint }: { label: string; hint?: string }) {
  const id = useId();
  const [name, setName] = useState<string | null>(null);
  return (
    <div>
      <label htmlFor={id} className="text-ink mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <label
        htmlFor={id}
        className="border-line bg-surface hover:border-ink flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm"
      >
        <Upload className="text-muted size-5" aria-hidden="true" />
        <span className="font-semibold">{name ?? "Choose a file"}</span>
        <span className="text-muted text-xs">
          {hint ?? "Development preview only: the file is not uploaded."}
        </span>
      </label>
      <input
        id={id}
        type="file"
        className="sr-only"
        onChange={(e) => setName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={cn(
        "bg-ink text-accent-light grid size-9 flex-none place-items-center rounded-full text-xs font-bold",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function AuditHistory({ entries }: { entries: AuditEntry[] }) {
  return (
    <ol className="border-line relative grid gap-4 border-l pl-5">
      {entries.map((e) => (
        <li key={e.id} className="relative text-sm">
          <span
            aria-hidden="true"
            className="border-accent bg-surface absolute top-1.5 -left-[26px] size-2.5 rounded-full border-2"
          />
          <p>
            <strong>{e.actor}</strong> {e.action.toLowerCase()}{" "}
            <span className="text-ink font-medium">{e.target}</span>
          </p>
          <time className="text-muted text-xs">{e.at}</time>
        </li>
      ))}
    </ol>
  );
}

const KIND_STYLE: Record<CalendarEvent["kind"], string> = {
  holiday: "bg-[#f8ebd2] text-[#7d4a08]",
  exam: "bg-[#f6dede] text-[#8a2b2b]",
  event: "bg-[#e3f1ea] text-[#1d5a41]",
  meeting: "bg-[#e1e9ee] text-[#1f4a63]",
};
const KIND_LABEL: Record<CalendarEvent["kind"], string> = {
  holiday: "Holiday",
  exam: "Exam",
  event: "Event",
  meeting: "Meeting",
};
export const kindLabel = (k: CalendarEvent["kind"]) => KIND_LABEL[k];

/** Month grid with event markers and a list of that month's events (keyboard-friendly). */
export function MonthCalendar({ events, initial }: { events: CalendarEvent[]; initial: string }) {
  const [ym, setYm] = useState(() => initial.slice(0, 7));
  const [yearStr, monthStr] = ym.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // Monday first
  const days = new Date(year, month + 1, 0).getDate();
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const e of events) m.set(e.date, [...(m.get(e.date) ?? []), e]);
    return m;
  }, [events]);
  const monthEvents = events
    .filter((e) => e.date.startsWith(ym))
    .sort((a, b) => a.date.localeCompare(b.date));
  const shift = (d: number) => {
    const n = new Date(year, month + d, 1);
    setYm(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
  };
  const title = first.toLocaleString("en-IN", { month: "long", year: "numeric" });
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-sans text-base font-bold" aria-live="polite">
            {title}
          </h2>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => shift(-1)} aria-label="Previous month">
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => shift(1)} aria-label="Next month">
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
        <div
          className="text-muted grid grid-cols-7 gap-1 text-center text-xs font-semibold"
          aria-hidden="true"
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d}>{d}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: startOffset }, (_, i) => (
            <span key={`b${i}`} />
          ))}
          {Array.from({ length: days }, (_, i) => {
            const date = `${ym}-${String(i + 1).padStart(2, "0")}`;
            const ev = byDate.get(date);
            return (
              <div
                key={date}
                className={cn(
                  "border-line min-h-14 rounded-md border p-1 text-xs",
                  ev && "bg-paper",
                )}
              >
                <span className="font-semibold tabular-nums">{i + 1}</span>
                {ev?.slice(0, 1).map((e) => (
                  <span
                    key={e.id}
                    className={cn(
                      "mt-0.5 block truncate rounded px-1 py-0.5 text-[0.65rem] font-semibold",
                      KIND_STYLE[e.kind],
                    )}
                  >
                    {e.title}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
      <Card>
        <CardHeader title={`Events in ${title}`} />
        {monthEvents.length === 0 ? (
          <p className="text-muted text-sm">Nothing scheduled this month.</p>
        ) : (
          <ul className="grid gap-3">
            {monthEvents.map((e) => (
              <li key={e.id} className="flex items-start gap-3 text-sm">
                <span className="border-line bg-paper flex w-11 flex-none flex-col rounded border py-1 text-center text-base leading-tight font-bold">
                  {Number(e.date.slice(8))}
                </span>
                <span>
                  <span className="font-semibold">{e.title}</span>
                  <span className="text-muted block text-xs">
                    {kindLabel(e.kind)} · {e.audience}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

/** Warns before the tab is closed or reloaded while there are unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);
}

/** Focus the first element matching `selector` when `deps` change (e.g. after a validation error). */
export function useFocusOnError(selector: string, trigger: unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    document.querySelector<HTMLElement>(selector)?.focus();
  }, [selector, trigger]);
}
