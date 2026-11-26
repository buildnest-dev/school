"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { todayIso } from "@/config/env";
import { downloadCsv } from "../shared/csv";
import { fmtDate } from "../shared/format";
import { sampleId, useData } from "../shared/use-data";

interface StaffRow {
  staffId: string;
  name: string;
  role: string;
  status: string;
  onApprovedLeave: boolean;
  monthPresent: number;
  monthAbsent: number;
  monthLeave: number;
}
interface StaffDay {
  date: string;
  saved: boolean;
  rows: StaffRow[];
}

const MARKS = [
  ["present", "Present"],
  ["absent", "Absent"],
  ["late", "Late"],
  ["half_day", "Half day"],
  ["leave", "On leave"],
] as const;

const sampleDay = (date: string): StaffDay => ({
  date,
  saved: false,
  rows: ["Kavita Iyer", "Arjun Menon", "Sana Sheikh", "Ramesh Gupta"].map((name, i) => ({
    staffId: `s-${i + 1}`,
    name,
    role: "teacher",
    status: i === 2 ? "leave" : "present",
    onApprovedLeave: i === 2,
    monthPresent: 18 - i,
    monthAbsent: i,
    monthLeave: i === 2 ? 2 : 0,
  })),
});

function DatePick({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Input
      type="date"
      aria-label="Date"
      className="max-w-48"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    />
  );
}

function StaffDayBody({ date }: { date: string }) {
  const d = useData<StaffDay>(`/staff-attendance?date=${date}`, sampleDay(date));
  const [changed, setChanged] = useState<Record<string, string>>({});
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  if (!d.data.rows.length) return <EmptyState title="No staff yet" />;
  const rows = d.data.rows.map((r) => ({ ...r, status: changed[r.staffId] ?? r.status }));
  const save = () =>
    d.send(
      "PUT",
      "/staff-attendance",
      { date, rows: rows.map((r) => ({ staffId: r.staffId, status: r.status })) },
      (cur) => ({ ...cur, saved: true, rows }),
      "Staff attendance saved",
    );
  return (
    <div className="grid max-w-3xl gap-3">
      <p className="text-muted text-sm">
        {d.data.saved ? "Saved for this day. You can still correct it." : "Not saved yet."}
      </p>
      <ul className="grid gap-2">
        {rows.map((r) => (
          <li key={r.staffId}>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink font-semibold">{r.name}</p>
                <p className="text-muted text-xs">
                  This month: {r.monthPresent} present · {r.monthAbsent} absent · {r.monthLeave}{" "}
                  leave
                  {r.onApprovedLeave ? " · leave approved today" : ""}
                </p>
              </div>
              <Select
                aria-label={`Attendance of ${r.name}`}
                className="w-40"
                value={r.status}
                onChange={(e) => setChanged({ ...changed, [r.staffId]: e.target.value })}
              >
                {MARKS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Card>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button onClick={save} disabled={d.busy || date > todayIso()}>
          Save attendance
        </Button>
        <Button
          variant="ghost"
          onClick={() =>
            downloadCsv(`staff-attendance-${date}.csv`, [
              ["Name", "Today", "Present this month", "Absent", "Leave"],
              ...rows.map((r) => [r.name, r.status, r.monthPresent, r.monthAbsent, r.monthLeave]),
            ])
          }
        >
          Download CSV
        </Button>
      </div>
    </div>
  );
}

export function StaffAttendancePage() {
  const [date, setDate] = useState(todayIso());
  return (
    <>
      <PageHeader
        title="Staff attendance"
        description="Mark who is in today."
        actions={<DatePick value={date} onChange={setDate} />}
      />
      <StaffDayBody key={date} date={date} />
    </>
  );
}

interface Need {
  sectionId: string;
  slot: number;
  period: string;
  classLabel: string;
  subject: string;
  absent: string;
  coverId: string | null;
  cover: string;
  free: { id: string; name: string }[];
}
interface CoverData {
  date: string;
  away: string[];
  needs: Need[];
}

const sampleCover = (date: string): CoverData => ({
  date,
  away: ["Sana Sheikh"],
  needs: [
    {
      sectionId: "8a",
      slot: 2,
      period: "Period 2",
      classLabel: "8 A",
      subject: "Science",
      absent: "Sana Sheikh",
      coverId: null,
      cover: "",
      free: [
        { id: "s-2", name: "Arjun Menon" },
        { id: "s-4", name: "Ramesh Gupta" },
      ],
    },
  ],
});

function CoverBody({ date }: { date: string }) {
  const d = useData<CoverData>(`/substitutions?date=${date}`, sampleCover(date));
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  if (!d.data.needs.length)
    return (
      <EmptyState
        title="No lesson needs cover"
        hint={
          d.data.away.length
            ? `${d.data.away.join(", ")} away, with no lessons on this day.`
            : "Mark staff attendance or approve leave, and their lessons appear here."
        }
      />
    );
  const arrange = (n: Need, id: string) => {
    const name = n.free.find((t) => t.id === id)?.name ?? "";
    return d.send(
      "POST",
      "/substitutions",
      { date, sectionId: n.sectionId, slot: n.slot, coverStaffId: id },
      (cur) => ({
        ...cur,
        needs: cur.needs.map((x) =>
          x.sectionId === n.sectionId && x.slot === n.slot
            ? { ...x, coverId: sampleId(), cover: name }
            : x,
        ),
      }),
      "Cover arranged",
    );
  };
  return (
    <ul className="grid max-w-3xl gap-3">
      {d.data.needs.map((n) => (
        <li key={`${n.sectionId}-${n.slot}`}>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-ink font-semibold">
                {n.period} · {n.classLabel} · {n.subject}
              </p>
              <p className="text-muted text-sm">{n.absent} is away</p>
            </div>
            {n.coverId ? (
              <div className="flex items-center gap-2 text-sm">
                <span>Covered by {n.cover}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={d.busy}
                  onClick={() =>
                    d.send(
                      "DELETE",
                      `/substitutions/${n.coverId}`,
                      undefined,
                      (cur) => ({
                        ...cur,
                        needs: cur.needs.map((x) =>
                          x.coverId === n.coverId ? { ...x, coverId: null, cover: "" } : x,
                        ),
                      }),
                      "Cover removed",
                    )
                  }
                >
                  Change
                </Button>
              </div>
            ) : n.free.length ? (
              <Select
                aria-label={`Cover for ${n.classLabel} ${n.period}`}
                className="w-56"
                value=""
                disabled={d.busy}
                onChange={(e) => e.target.value && void arrange(n, e.target.value)}
              >
                <option value="">Choose a free teacher</option>
                {n.free.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            ) : (
              <span className="text-bad text-sm font-medium">No teacher is free</span>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function CoverPage() {
  const [date, setDate] = useState(todayIso());
  return (
    <>
      <PageHeader
        title="Cover lessons"
        description="Give the lessons of absent teachers to someone who is free."
        actions={<DatePick value={date} onChange={setDate} />}
      />
      <CoverBody key={date} date={date} />
    </>
  );
}

interface MyCover {
  id: string;
  slot: number;
  period: string;
  classLabel: string;
  subject: string;
  room: string;
}

function MyCoverBody({ date }: { date: string }) {
  const d = useData<{ date: string; mine: MyCover[] }>(`/substitutions?date=${date}`, {
    date,
    mine: [
      {
        id: "x1",
        slot: 3,
        period: "Period 3",
        classLabel: "7 B",
        subject: "Mathematics",
        room: "R-12",
      },
    ],
  });
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={2} />;
  if (!d.data.mine.length) return <EmptyState title={`No cover lessons on ${fmtDate(date)}`} />;
  return (
    <Card className="max-w-2xl">
      <CardHeader title="You are covering" />
      <ul className="grid gap-2">
        {d.data.mine.map((c) => (
          <li key={c.id} className="text-sm">
            <span className="text-ink font-semibold">{c.period}</span> · {c.classLabel} ·{" "}
            {c.subject}
            {c.room ? ` · ${c.room}` : ""}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function TeacherCovers() {
  const [date, setDate] = useState(todayIso());
  return (
    <>
      <PageHeader
        title="Cover lessons"
        description="Classes you take for an absent colleague."
        actions={<DatePick value={date} onChange={setDate} />}
      />
      <MyCoverBody key={date} date={date} />
    </>
  );
}
