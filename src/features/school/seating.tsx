"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useData } from "../shared/use-data";
import { downloadCsv } from "../shared/csv";
import { readRooms, seatingPlan } from "./seating-plan";

interface Report {
  columns: string[];
  rows: (string | number)[][];
}

const SAMPLE: Report = {
  columns: ["Admission no.", "Name", "Class", "Gender", "Status"],
  rows: ["7 A", "7 B", "8 A"].flatMap((c, n) =>
    Array.from({ length: 8 }, (_, i) => [`${n}${i}`, `Student ${n * 8 + i + 1}`, c, "", "active"]),
  ),
};

export function SeatingPage() {
  const d = useData<Report>("/reports/builder?dataset=students", SAMPLE);
  const [classes, setClasses] = useState<string[]>([]);
  const [rooms, setRooms] = useState("Room 1: 20\nRoom 2: 20");
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  const at = (name: string) => d.data!.columns.indexOf(name);
  const active = d.data.rows.filter((r) => r[at("Status")] === "active" && r[at("Class")]);
  const labels = [...new Set(active.map((r) => String(r[at("Class")])))].sort((a, b) =>
    a.localeCompare(b, "en", { numeric: true }),
  );
  const plan = seatingPlan(
    active
      .filter((r) => classes.includes(String(r[at("Class")])))
      .map((r) => ({ name: String(r[at("Name")]), classLabel: String(r[at("Class")]) })),
    readRooms(rooms),
  );
  const any = plan.rooms.some((r) => r.seats.length);
  return (
    <>
      <div className="no-print">
        <PageHeader
          title="Exam seating"
          description="Mix classes across rooms, then print or download the plan."
        />
        <div className="mb-5 grid max-w-3xl gap-5 md:grid-cols-2">
          <Card>
            <CardHeader title="Classes writing the exam" />
            <div className="flex flex-wrap gap-3">
              {labels.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={classes.includes(c)}
                    onChange={(e) =>
                      setClasses(
                        e.target.checked ? [...classes, c] : classes.filter((x) => x !== c),
                      )
                    }
                  />
                  {c}
                </label>
              ))}
            </div>
          </Card>
          <Card>
            <Field id="rooms" label="Rooms and seats" hint="One room on each line: Room 1: 30">
              {(a) => <Textarea {...a} value={rooms} onChange={(e) => setRooms(e.target.value)} />}
            </Field>
          </Card>
        </div>
        {any ? (
          <div className="mb-5 flex gap-2">
            <Button onClick={() => window.print()}>Print plan</Button>
            <Button
              variant="ghost"
              onClick={() =>
                downloadCsv("seating.csv", [
                  ["Room", "Seat", "Student", "Class"],
                  ...plan.rooms.flatMap((r) =>
                    r.seats.map((s, i) => [r.room, i + 1, s.name, s.classLabel]),
                  ),
                ])
              }
            >
              Download CSV
            </Button>
          </div>
        ) : null}
      </div>
      {!any ? (
        <EmptyState title="Choose classes and rooms to see the plan" />
      ) : (
        <div className="print-sheet grid gap-5 md:grid-cols-2">
          {plan.rooms
            .filter((r) => r.seats.length)
            .map((r) => (
              <Card key={r.room}>
                <CardHeader title={`${r.room} (${r.seats.length})`} />
                <ol className="grid gap-1 text-sm">
                  {r.seats.map((s, i) => (
                    <li key={i}>
                      {i + 1}. {s.name} · {s.classLabel}
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
        </div>
      )}
      {plan.unseated.length ? (
        <p role="alert" className="text-bad mt-4 font-semibold">
          {plan.unseated.length} student(s) have no seat. Add a room or more seats.
        </p>
      ) : null}
    </>
  );
}
