import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Product-window chrome used by every interface preview on the page. */
export function AppWindow({
  title,
  pill = "Sample",
  wrapTitle = false,
  className,
  children,
  ...props
}: { title: ReactNode; pill?: ReactNode; wrapTitle?: boolean } & Omit<
  ComponentPropsWithoutRef<"div">,
  "title"
>) {
  return (
    <div
      className={cn(
        "bg-surface border-line shadow-window relative rounded-[10px] border text-[0.82rem] leading-snug",
        className,
      )}
      {...props}
    >
      <div className="bg-paper border-line flex items-center gap-3 rounded-t-[10px] border-b px-3.5 py-2.5">
        <span className="hidden gap-[5px] sm:flex" aria-hidden="true">
          <i className="bg-line size-2 rounded-full" />
          <i className="bg-line size-2 rounded-full" />
          <i className="bg-line size-2 rounded-full" />
        </span>
        <span
          className={cn(
            "text-ink min-w-0 flex-1 text-[0.78rem] font-semibold",
            !wrapTitle && "truncate",
          )}
        >
          {title}
        </span>
        <Pill>{pill}</Pill>
      </div>
      {children}
    </div>
  );
}

export function Pill({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "border-line bg-surface text-muted rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold whitespace-nowrap",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Panel({
  title,
  meta,
  className,
  children,
  ...props
}: { title: ReactNode; meta?: ReactNode } & Omit<ComponentPropsWithoutRef<"section">, "title">) {
  return (
    <section
      className={cn("border-line bg-surface min-w-0 rounded-md border p-3.5", className)}
      {...props}
    >
      <h3 className="text-ink mb-2.5 flex items-baseline justify-between gap-2 font-sans text-[0.76rem] font-bold tracking-normal">
        {title}
        {meta ? <span className="text-muted text-[0.68rem] font-medium">{meta}</span> : null}
      </h3>
      {children}
    </section>
  );
}

const tagTone = {
  neutral: "bg-paper-2 text-muted",
  red: "bg-[#f4dcdc] text-bad",
  amber: "bg-[#f6e5c8] text-warn",
} as const;

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tagTone;
  children: ReactNode;
}) {
  return (
    <i
      className={cn(
        "flex-none rounded-[3px] px-1.5 py-0.5 text-[0.6rem] font-bold tracking-wide uppercase not-italic",
        tagTone[tone],
      )}
    >
      {children}
    </i>
  );
}

export function HBars({
  rows,
  className,
}: {
  rows: { label: string; pct: number; text?: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("grid gap-2", className)}>
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[92px_1fr_34px] items-center gap-2 text-[0.72rem]"
        >
          <span>{r.label}</span>
          <i className="bg-paper-2 block h-1.5 overflow-hidden rounded-[3px]">
            <b
              className="ease-soft block h-full bg-[var(--school,var(--color-ink-2))] transition-[width,background-color] duration-700"
              style={{ width: `${r.pct}%` }}
            />
          </i>
          <em className="text-right font-semibold not-italic tabular-nums">
            {r.text ?? `${r.pct}%`}
          </em>
        </li>
      ))}
    </ul>
  );
}

export function DateRow({
  day,
  month,
  children,
}: {
  day: string;
  month: string;
  children: ReactNode;
}) {
  return (
    <li className="flex items-center gap-2.5 text-[0.75rem]">
      <span className="border-line bg-paper text-ink flex w-9 flex-none flex-col rounded-sm border py-[3px] text-center text-[0.85rem] leading-tight font-bold">
        {day}
        <small className="text-muted text-[0.55rem] font-medium tracking-wide uppercase">
          {month}
        </small>
      </span>
      <span>{children}</span>
    </li>
  );
}
