"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { env } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api/client";
import { BellScheduleButton, TeacherWeekButton, TimetableEditor } from "./timetable-edit";

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
interface Period {
  day: number;
  slot: number;
  subjectId: string;
  staffId: string | null;
  subject: string;
  teacher: string | null;
  room: string | null;
}
interface Week {
  classSection: string;
  bell: { slot: number; label: string; startsAt: string; endsAt: string; isBreak: boolean }[];
  periods: Period[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** One colour for each subject, so the week can be read at a glance. */
const TINTS = [
  "bg-[#eef7d9] border-[#cfe6a0]",
  "bg-[#fdf0d5] border-[#f2d79a]",
  "bg-[#e3f0fb] border-[#bcd9f2]",
  "bg-[#fbe6ec] border-[#f0c2d0]",
  "bg-[#eee9fb] border-[#d3c8f3]",
  "bg-[#ddf3ee] border-[#b2e0d5]",
];

function WeekBlocks({ week, onPick }: { week: Week; onPick?: () => void }) {
  const subjects = [...new Set(week.periods.map((p) => p.subject))].sort();
  return (
    <Card className="overflow-x-auto p-3">
      <table className="w-full min-w-[46rem] table-fixed border-separate border-spacing-1.5 text-sm">
        <caption className="sr-only">Timetable of {week.classSection}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-28 px-2 py-1 text-left">
              Period
            </th>
            {DAYS.map((d) => (
              <th key={d} scope="col" className="bg-paper rounded-lg px-2 py-2 text-center">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {week.bell.map((b) => (
            <tr key={b.slot}>
              <th scope="row" className="px-2 py-1 text-left font-semibold">
                {b.label}
                <span className="text-muted block text-xs font-normal">
                  {b.startsAt}–{b.endsAt}
                </span>
              </th>
              {b.isBreak ? (
                <td
                  colSpan={DAYS.length}
                  className="border-line text-muted rounded-xl border border-dashed py-2 text-center"
                >
                  {b.label}
                </td>
              ) : (
                DAYS.map((d, i) => {
                  const p = week.periods.find((x) => x.day === i + 1 && x.slot === b.slot);
                  const look = p
                    ? TINTS[subjects.indexOf(p.subject) % TINTS.length]
                    : "border-line text-muted border-dashed";
                  const box = `grid h-16 w-full content-center rounded-xl border px-1 text-center ${look}`;
                  const inside = p ? (
                    <>
                      <span className="truncate font-semibold">{p.subject}</span>
                      <span className="text-muted truncate text-xs">
                        {[p.teacher, p.room].filter(Boolean).join(" · ")}
                      </span>
                    </>
                  ) : (
                    <span>{onPick ? "+" : "Free"}</span>
                  );
                  return (
                    <td key={d}>
                      {onPick ? (
                        <button
                          type="button"
                          className={`${box} hover:shadow-card cursor-pointer`}
                          aria-label={`${d} ${b.label}: ${p ? p.subject : "free"}. Edit`}
                          onClick={onPick}
                        >
                          {inside}
                        </button>
                      ) : (
                        <div className={box}>{inside}</div>
                      )}
                    </td>
                  );
                })
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/** The weekly timetable of any class, as blocks of days and periods. */
export function SchoolTimetable() {
  const classes = useAsync(() => apiRequest<ClassRow[]>("/classes"), []);
  const [sectionId, setSectionId] = useState("");
  const [editing, setEditing] = useState(false);
  const role = useSession().user?.role;
  const canEdit =
    env.dataSource === "api" &&
    (role === "school_owner" || role === "principal" || role === "vice_principal");
  const options = (classes.data ?? []).flatMap((c) =>
    c.sections.map((s) => ({ id: s.id, label: `${c.name} · ${s.name}` })),
  );
  // Until one is picked, the first class that exists is shown.
  const current = sectionId || options[0]?.id || "";

  const week = useAsync(
    () =>
      current
        ? apiRequest<Week>(`/timetable/sections/${current}`)
        : Promise.resolve(undefined as Week | undefined),
    [current],
  );

  return (
    <>
      <PageHeader title="Timetable" description="The weekly timetable of each class." />
      {classes.error ? (
        <ErrorState message={classes.error.message} onRetry={classes.reload} />
      ) : !classes.data ? (
        <LoadingBlock />
      ) : options.length === 0 ? (
        <p className="text-sm">This school has no classes yet.</p>
      ) : (
        <div className="grid gap-4">
          <Field id="tt-section" label="Class" className="max-w-xs">
            {(a) => (
              <Select
                {...a}
                value={current}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setEditing(false);
                }}
              >
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {canEdit && week.data ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setEditing((v) => !v)}>
                {editing ? "Close editing" : "Edit timetable"}
              </Button>
              <BellScheduleButton bell={week.data.bell} onSaved={week.reload} />
              <TeacherWeekButton />
            </div>
          ) : null}
          {week.error ? (
            <ErrorState message={week.error.message} onRetry={week.reload} />
          ) : !week.data ? (
            <LoadingBlock />
          ) : editing && !week.loading ? (
            week.data.bell.some((b) => !b.isBreak) ? (
              <TimetableEditor
                key={current}
                sectionId={current}
                bell={week.data.bell}
                periods={week.data.periods}
                done={() => {
                  setEditing(false);
                  week.reload();
                }}
              />
            ) : (
              <p className="text-sm">Set the period timings first.</p>
            )
          ) : week.data.bell.length === 0 ? (
            <Card className="max-w-xl">
              <p className="text-sm">Set the period timings first.</p>
            </Card>
          ) : (
            <>
              {week.data.periods.length === 0 ? (
                <p className="text-muted text-sm">
                  Nothing is filled in for {week.data.classSection} yet.
                  {canEdit ? " Press any block to start." : ""}
                </p>
              ) : null}
              <WeekBlocks week={week.data} onPick={canEdit ? () => setEditing(true) : undefined} />
            </>
          )}
        </div>
      )}
    </>
  );
}
