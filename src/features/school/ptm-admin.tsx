"use client";

import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import { fmtDate } from "../shared/format";
import { ApiAction, QuickAdd } from "../shared/quick-add";

interface Slot {
  id: string;
  teacher: string;
  date: string;
  time: string;
  bookedBy: string;
}

/** The school offers parent-teacher meeting slots; parents book them from their own side. */
export function PtmAdmin() {
  const d = useAsync(() => apiRequest<{ items: Slot[] }>("/ptm-slots").then((r) => r.items), []);
  return (
    <>
      <PageHeader
        title="Parent-teacher meetings"
        description="Offer meeting slots. Parents pick a free one from their side."
        actions={
          <QuickAdd
            label="Add a slot"
            title="Add a meeting slot"
            endpoint="/ptm-slots"
            onCreated={d.reload}
            fields={[
              { key: "teacherName", label: "Teacher" },
              { key: "date", label: "Date", type: "date" },
              { key: "time", label: "Time", placeholder: "10:00 am" },
            ]}
          />
        }
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock />
      ) : d.data.length === 0 ? (
        <EmptyState title="No slots yet" hint="Add a slot and parents can book it." />
      ) : (
        <ul className="grid max-w-2xl gap-3">
          {d.data.map((s) => (
            <li key={s.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{s.teacher}</span>
                  <span className="text-muted text-sm">
                    {fmtDate(s.date)} · {s.time}
                    {s.bookedBy ? ` · booked by ${s.bookedBy}` : ""}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge status={s.bookedBy ? "booked" : "free"} />
                  <ApiAction
                    label="Remove"
                    method="DELETE"
                    endpoint={`/ptm-slots/${s.id}`}
                    onDone={d.reload}
                  />
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
