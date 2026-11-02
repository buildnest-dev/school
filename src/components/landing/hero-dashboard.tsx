"use client";

import { useState } from "react";
import { CountUp } from "@/components/motion/count-up";
import { AppWindow, DateRow, HBars, Panel, Pill, Tag } from "@/components/mockups/primitives";
import { CAMPUSES, SCHOOLS, type SchoolKey } from "@/lib/data/schools";
import { cn } from "@/lib/utils";

const ACCENTS: Record<SchoolKey, string> = { northfield: "#b8501e", riverstone: "#2b5fa8" };

/**
 * Illustrative admin dashboard. The workspace switcher and group view are a visual demonstration
 * with fictional data: no tenant switching or backend exists.
 */
export function HeroDashboard() {
  const [school, setSchool] = useState<SchoolKey>("northfield");
  const [groupView, setGroupView] = useState(false);
  const s = SCHOOLS[school];

  return (
    <AppWindow
      data-hero="app"
      aria-label="Illustrative school administration dashboard with sample data"
      style={{ "--school": ACCENTS[school] } as React.CSSProperties}
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span
            role="group"
            aria-label="Sample school workspaces"
            className="border-line bg-surface flex flex-wrap gap-0.5 rounded-md border p-0.5"
          >
            {(Object.keys(SCHOOLS) as SchoolKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={school === key}
                onClick={() => setSchool(key)}
                className={cn(
                  "min-h-8 rounded-[4px] px-3 text-xs font-semibold transition-colors",
                  school === key
                    ? "bg-(--school) text-white"
                    : "text-muted hover:bg-paper-2 hover:text-ink",
                )}
              >
                {SCHOOLS[key].name}
              </button>
            ))}
          </span>
          <button
            type="button"
            aria-pressed={groupView}
            onClick={() => setGroupView((v) => !v)}
            className={cn(
              "border-line min-h-8 rounded-md border px-3 text-xs font-semibold transition-colors",
              groupView ? "bg-ink border-ink text-white" : "bg-surface text-muted hover:text-ink",
            )}
          >
            Group view
          </button>
        </span>
      }
      pill="Sample data"
      wrapTitle
    >
      <div className="grid md:grid-cols-[48px_1fr]">
        <aside
          aria-hidden="true"
          className="bg-ink hidden flex-col items-center gap-4 rounded-bl-[10px] py-[18px] md:flex"
        >
          <span className="border-accent-light/100 bg-accent-light/20 size-[18px] rounded-[3px] border-[1.5px]" />
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="size-[18px] rounded-[3px] border-[1.5px] border-[#5d7b7e]" />
          ))}
        </aside>

        <div className="grid min-w-0 content-start gap-3.5 p-4">
          <div data-hero="panel" className="flex items-center gap-3">
            <span className="font-display grid size-9 flex-none place-items-center rounded-[4px] bg-(--school) text-[1.1rem] font-semibold text-white transition-colors duration-300">
              {s.initial}
            </span>
            <div className="grid min-w-0 flex-1">
              <strong className="font-display text-ink text-[1.15rem] font-medium">{s.name}</strong>
              <span className="text-muted text-xs">{s.classes}</span>
            </div>
            <Pill className="hidden sm:inline-block">AY 2026–27</Pill>
          </div>

          {groupView ? (
            <Panel title="School group overview" meta="Authorized group administrators">
              <table className="w-full text-left text-[0.8rem]">
                <caption className="sr-only">Sample consolidated figures by campus</caption>
                <thead>
                  <tr className="text-muted text-[0.68rem] tracking-wider uppercase">
                    {["Campus", "Students", "Present today", "Fees collected"].map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="border-line border-b px-1.5 py-2.5 font-semibold"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAMPUSES.map((c) => (
                    <tr key={c.name} className="tabular-nums">
                      <th
                        scope="row"
                        className="border-line text-ink border-b px-1.5 py-2.5 font-semibold"
                      >
                        {c.name}
                      </th>
                      <td className="border-line border-b px-1.5 py-2.5">
                        {c.students.toLocaleString("en-IN")}
                      </td>
                      <td className="border-line border-b px-1.5 py-2.5">{c.present}</td>
                      <td className="border-line border-b px-1.5 py-2.5">{c.fees}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="text-ink font-bold">
                    <th scope="row" className="px-1.5 py-2.5">
                      Group total
                    </th>
                    <td className="px-1.5 py-2.5 tabular-nums">2,520</td>
                    <td colSpan={2} className="text-muted px-1.5 py-2.5 font-medium">
                      Consolidated, read-only view
                    </td>
                  </tr>
                </tfoot>
              </table>
              <p className="text-muted mt-3 text-xs">
                Each campus workspace keeps its own users, records and permissions. Sample data.
              </p>
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                <Kpi className="col-span-2 md:col-span-1" label="Enrollment" sub={s.enrollSub}>
                  <CountUp value={s.enroll} format="int" initialDelay={1.7} />
                  <svg
                    className="mt-1.5 h-[26px] w-full fill-none stroke-(--school)"
                    viewBox="0 0 120 28"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <polyline
                      vectorEffect="non-scaling-stroke"
                      strokeWidth="1.6"
                      points="0,22 15,20 30,21 45,16 60,17 75,11 90,12 105,6 120,4"
                    />
                  </svg>
                </Kpi>
                <Kpi label="Present today" sub={s.presentSub}>
                  <CountUp value={s.present} format="pct" initialDelay={1.85} />
                  <Bar pct={s.present} />
                </Kpi>
                <Kpi label="Fees collected" sub={s.feesSub}>
                  <CountUp value={s.fees} format="lakh" initialDelay={2} />
                  <Bar pct={s.feesPct} />
                </Kpi>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Panel data-hero="panel" title="Attendance by wing" meta="Today">
                  <HBars rows={s.wings.map((w) => ({ label: w.label, pct: w.pct }))} />
                </Panel>
                <Panel
                  data-hero="panel"
                  title={
                    <>
                      Academic tasks{" "}
                      <span className="bg-accent rounded-full px-1.5 text-white">3</span>
                    </>
                  }
                >
                  <ul className="grid gap-2 text-[0.75rem]">
                    <li className="flex items-center gap-2">
                      <Tag tone="red">Due</Tag>Publish Unit Test 2 timetable
                    </li>
                    <li className="flex items-center gap-2">
                      <Tag tone="amber">Today</Tag>Review 3 leave requests
                    </li>
                    <li className="flex items-center gap-2">
                      <Tag>Fri</Tag>Finalise Class 9 sections
                    </li>
                  </ul>
                </Panel>
                <Panel data-hero="panel" title="Upcoming" meta="Next 7 days">
                  <ul className="grid gap-2">
                    <DateRow day="24" month="Oct">
                      Unit Test 2 begins
                    </DateRow>
                    <DateRow day="26" month="Oct">
                      Parent meeting · Classes 1–5
                    </DateRow>
                    <DateRow day="28" month="Oct">
                      Annual sports day
                    </DateRow>
                  </ul>
                </Panel>
              </div>
            </>
          )}
        </div>
      </div>
    </AppWindow>
  );
}

function Kpi({
  label,
  sub,
  className,
  children,
}: {
  label: string;
  sub: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      data-hero="panel"
      className={cn(
        "border-line bg-surface flex min-w-0 flex-col gap-0.5 rounded-md border p-3.5",
        className,
      )}
    >
      <span className="text-muted text-[0.68rem] font-semibold tracking-[0.08em] uppercase">
        {label}
      </span>
      <strong className="font-display text-ink text-[1.9rem] leading-tight font-medium tabular-nums">
        {children}
      </strong>
      <span className="text-muted text-[0.72rem]">{sub}</span>
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  return (
    <span className="bg-paper-2 mt-2 mb-1 block h-[5px] overflow-hidden rounded-[3px]">
      <span
        className="ease-soft block h-full rounded-[3px] bg-(--school) transition-[width,background-color] duration-700"
        style={{ width: `${pct}%` }}
      />
    </span>
  );
}
