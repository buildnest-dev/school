"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

export interface BellSlot {
  slot: number;
  label: string;
  startsAt: string;
  endsAt: string;
  isBreak: boolean;
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function useSave() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const save = async (path: string, body: unknown, done: () => void) => {
    setBusy(true);
    try {
      await apiRequest(path, { method: "PUT", body });
      toast({ title: "Saved" });
      done();
    } catch (e) {
      toast({
        title: "Couldn’t save",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return { save, busy };
}

const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};
const toTime = (n: number) =>
  `${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** The school's periods and breaks, one block for each, with clock pickers. */
export function BellScheduleButton({ bell, onSaved }: { bell: BellSlot[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<BellSlot[]>([]);
  const { save, busy } = useSave();
  const start = () => {
    setRows(bell.map((b) => ({ ...b })));
    setOpen(true);
  };
  const change = (i: number, part: Partial<BellSlot>) =>
    setRows((r) => r.map((row, n) => (n === i ? { ...row, ...part } : row)));
  // A new block starts when the last one ends.
  const add = (isBreak: boolean) =>
    setRows((r) => {
      const from = r.at(-1)?.endsAt || "08:00";
      const label = isBreak ? "Break" : `Period ${r.filter((x) => !x.isBreak).length + 1}`;
      const endsAt = toTime(toMinutes(from) + (isBreak ? 20 : 40));
      // Blocks keep their number, because lessons already in the timetable point to it.
      const slot = (r.at(-1)?.slot ?? 0) + 1;
      return [...r, { slot, label, startsAt: from, endsAt, isBreak }];
    });
  const submit = () => {
    // Renumber only if a number would pass the limit of 12.
    const slots = rows.some((r) => r.slot > 12)
      ? rows.map((r, i) => ({ ...r, slot: i + 1 }))
      : rows;
    save("/timetable/bell-schedule", { slots }, () => {
      setOpen(false);
      onSaved();
    });
  };
  return (
    <>
      <Button variant="ghost" onClick={start}>
        Period timings
      </Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)} title="Period timings">
        <div className="grid gap-3">
          <ol className="grid max-h-[55vh] gap-2 overflow-y-auto">
            {rows.map((row, i) => (
              <li
                key={i}
                className={`grid gap-2 rounded-xl border p-3 ${
                  row.isBreak ? "border-[#f2d79a] bg-[#fdf0d5]" : "border-[#cfe6a0] bg-[#eef7d9]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Input
                    aria-label={`Name of block ${i + 1}`}
                    value={row.label}
                    onChange={(e) => change(i, { label: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove ${row.label}`}
                    onClick={() => setRows((r) => r.filter((_, n) => n !== i))}
                  >
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <label className="grid gap-1 text-xs font-semibold">
                    Starts
                    <Input
                      type="time"
                      value={row.startsAt}
                      onChange={(e) => change(i, { startsAt: e.target.value })}
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">
                    Ends
                    <Input
                      type="time"
                      value={row.endsAt}
                      onChange={(e) => change(i, { endsAt: e.target.value })}
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={row.isBreak}
                    onChange={(e) => change(i, { isBreak: e.target.checked })}
                  />
                  This is a break
                </label>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => add(false)}
              disabled={rows.length >= 12}
            >
              Add period
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => add(true)}
              disabled={rows.length >= 12}
            >
              Add break
            </Button>
          </div>
          <div>
            <Button onClick={submit} disabled={busy || !rows.length}>
              {busy ? "Saving…" : "Save timings"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

interface Cell {
  subjectId: string;
  staffId: string;
  room?: string;
}

/** Pick the subject and teacher of every period of one class, then save the whole week. */
export function TimetableEditor({
  sectionId,
  bell,
  periods,
  done,
}: {
  sectionId: string;
  bell: BellSlot[];
  periods: {
    day: number;
    slot: number;
    subjectId: string;
    staffId: string | null;
    room: string | null;
  }[];
  done: () => void;
}) {
  const choices = useAsync(async () => {
    const [classes, teachers] = await Promise.all([
      apiRequest<{ sections: { id: string }[]; subjects: { id: string; name: string }[] }[]>(
        "/classes",
      ),
      apiRequest<{ items: { id: string; name: string }[] }>("/staff", {
        query: { role: "teacher", status: "active" },
      }),
    ]);
    return {
      subjects: classes.find((c) => c.sections.some((s) => s.id === sectionId))?.subjects ?? [],
      teachers: teachers.items,
    };
  }, [sectionId]);
  const [week, setWeek] = useState<Record<string, Cell>>(() =>
    Object.fromEntries(
      periods.map((p) => [
        `${p.day}-${p.slot}`,
        { subjectId: p.subjectId, staffId: p.staffId ?? "", room: p.room ?? undefined },
      ]),
    ),
  );
  const { save, busy } = useSave();
  if (!choices.data) return <LoadingBlock />;
  if (!choices.data.subjects.length)
    return (
      <Card className="max-w-xl">
        <p className="text-sm">
          Add this class’s subjects first, on the Classes, subjects & syllabus page.
        </p>
      </Card>
    );
  const set = (key: string, change: Partial<Cell>) =>
    setWeek((w) => ({ ...w, [key]: { ...(w[key] ?? { subjectId: "", staffId: "" }), ...change } }));
  const submit = () =>
    save(
      `/timetable/sections/${sectionId}`,
      {
        periods: Object.entries(week)
          .filter(([, c]) => c.subjectId)
          .map(([key, c]) => {
            const [day, slot] = key.split("-").map(Number);
            return {
              day,
              slot,
              subjectId: c.subjectId,
              staffId: c.staffId || null,
              ...(c.room ? { room: c.room } : {}),
            };
          }),
      },
      done,
    );
  return (
    <div className="grid gap-3">
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[60rem] border-collapse text-sm">
          <caption className="sr-only">Edit the timetable</caption>
          <thead>
            <tr className="border-line border-b text-left">
              <th scope="col" className="px-3 py-2">
                Period
              </th>
              {DAYS.map((d) => (
                <th key={d} scope="col" className="px-2 py-2">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bell
              .filter((b) => !b.isBreak)
              .map((b) => (
                <tr key={b.slot} className="border-line border-b align-top last:border-0">
                  <th scope="row" className="px-3 py-2 text-left font-medium">
                    {b.label}
                  </th>
                  {DAYS.map((d, i) => {
                    const key = `${i + 1}-${b.slot}`;
                    const cell = week[key];
                    return (
                      <td key={d} className="grid gap-1 px-2 py-2">
                        <Select
                          aria-label={`${d} ${b.label} subject`}
                          value={cell?.subjectId ?? ""}
                          onChange={(e) => set(key, { subjectId: e.target.value })}
                        >
                          <option value="">Free</option>
                          {choices.data!.subjects.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </Select>
                        <Select
                          aria-label={`${d} ${b.label} teacher`}
                          value={cell?.staffId ?? ""}
                          disabled={!cell?.subjectId}
                          onChange={(e) => set(key, { staffId: e.target.value })}
                        >
                          <option value="">No teacher</option>
                          {choices.data!.teachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </Select>
                      </td>
                    );
                  })}
                </tr>
              ))}
          </tbody>
        </table>
      </Card>
      <div>
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save timetable"}
        </Button>
      </div>
    </div>
  );
}

function TeacherWeek() {
  const teachers = useAsync(
    () =>
      apiRequest<{ items: { id: string; name: string }[] }>("/staff", {
        query: { role: "teacher", status: "active" },
      }),
    [],
  );
  const [id, setId] = useState("");
  const week = useAsync(
    () =>
      id
        ? apiRequest<{
            periods: {
              id: string;
              day: number;
              slot: number;
              subject: string;
              classSection: string;
            }[];
          }>(`/timetable/staff/${id}`)
        : Promise.resolve(undefined),
    [id],
  );
  return (
    <div className="grid max-h-[65vh] gap-3 overflow-y-auto text-sm">
      <Select aria-label="Teacher" value={id} onChange={(e) => setId(e.target.value)}>
        <option value="">Choose a teacher</option>
        {teachers.data?.items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Select>
      {week.data ? (
        week.data.periods.length ? (
          <ul className="grid gap-1.5">
            {week.data.periods.map((p) => (
              <li key={p.id}>
                {DAYS[p.day - 1] ?? "Sun"} · period slot {p.slot} · {p.subject} · {p.classSection}
              </li>
            ))}
          </ul>
        ) : (
          <p>No periods for this teacher yet.</p>
        )
      ) : null}
    </div>
  );
}

/** Any teacher's week, for the principal. */
export function TeacherWeekButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        A teacher’s week
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="A teacher’s week">
        {open ? <TeacherWeek /> : null}
      </Dialog>
    </>
  );
}
