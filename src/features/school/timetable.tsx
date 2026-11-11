"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}
interface Period {
  day: number;
  slot: number;
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

/** The weekly timetable of any class, as a grid of days and periods. */
export function SchoolTimetable() {
  const classes = useAsync(() => apiRequest<ClassRow[]>("/classes"), []);
  const [sectionId, setSectionId] = useState("");
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
              <Select {...a} value={current} onChange={(e) => setSectionId(e.target.value)}>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {week.error ? (
            <ErrorState message={week.error.message} onRetry={week.reload} />
          ) : !week.data ? (
            <LoadingBlock />
          ) : week.data.periods.length === 0 ? (
            <Card className="max-w-xl">
              <p className="text-sm">No timetable has been set for {week.data.classSection} yet.</p>
            </Card>
          ) : (
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">Timetable of {week.data.classSection}</caption>
                <thead>
                  <tr className="border-line border-b text-left">
                    <th scope="col" className="px-3 py-2">
                      Period
                    </th>
                    {DAYS.map((d) => (
                      <th key={d} scope="col" className="px-3 py-2">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {week.data.bell.map((b) => (
                    <tr key={b.slot} className="border-line border-b align-top last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {b.label}
                        <span className="text-muted block text-xs font-normal">
                          {b.startsAt}–{b.endsAt}
                        </span>
                      </th>
                      {b.isBreak ? (
                        <td colSpan={DAYS.length} className="text-muted px-3 py-2 text-center">
                          Break
                        </td>
                      ) : (
                        DAYS.map((_, i) => {
                          const p = week.data!.periods.find(
                            (x) => x.day === i + 1 && x.slot === b.slot,
                          );
                          return (
                            <td key={i} className="px-3 py-2">
                              {p ? (
                                <>
                                  <span className="font-medium">{p.subject}</span>
                                  <span className="text-muted block text-xs">
                                    {[p.teacher, p.room].filter(Boolean).join(" · ")}
                                  </span>
                                </>
                              ) : (
                                <span className="text-muted">–</span>
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
          )}
        </div>
      )}
    </>
  );
}
