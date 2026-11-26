"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select, Textarea } from "@/components/ui/field";
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

/** The school's periods and breaks, one on each line. */
export function BellScheduleButton({ bell, onSaved }: { bell: BellSlot[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const { save, busy } = useSave();
  const start = () => {
    setText(
      bell
        .map((b) => [b.label, b.startsAt, b.endsAt, ...(b.isBreak ? ["break"] : [])].join(", "))
        .join("\n"),
    );
    setOpen(true);
  };
  const submit = () => {
    const slots = text
      .split("\n")
      .map((line) => line.split(",").map((p) => p.trim()))
      .filter((p) => p[0])
      .map(([label, startsAt, endsAt, kind], i) => ({
        slot: i + 1,
        label,
        startsAt: startsAt ?? "",
        endsAt: endsAt ?? "",
        isBreak: kind?.toLowerCase() === "break",
      }));
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
          <label className="grid gap-1.5 text-sm font-semibold">
            One on each line: name, start, end. Add “break” for a break.
            <Textarea
              rows={9}
              value={text}
              placeholder={"Period 1, 08:00, 08:45\nTiffin, 08:45, 09:00, break"}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
          <div>
            <Button onClick={submit} disabled={busy || !text.trim()}>
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
