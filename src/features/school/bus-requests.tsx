"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api/client";

interface Waiting {
  students: { id: string; name: string; classSection: string; address: string | null }[];
  routes: { id: string; name: string; stops: { id: string; name: string }[] }[];
}

/** New students who asked for the bus: pick a route and stop for each. */
export function BusRequests({ onChanged }: { onChanged: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Waiting | null>(null);
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const fail = (title: string, err: unknown) =>
    toast({
      title,
      description: err instanceof Error ? err.message : "Please try again.",
      tone: "error",
    });
  const load = () =>
    apiRequest<Waiting>("/transport/requests")
      .then(setData)
      .catch((err) => fail("Couldn’t load the list", err));

  const assign = async (studentId: string) => {
    const [routeId, stopId] = (choice[studentId] ?? "").split("|");
    setBusy(studentId);
    try {
      await apiRequest(`/transport/students/${studentId}`, {
        method: "PUT",
        body: { routeId, stopId },
      });
      toast({ title: "Bus seat given" });
      await load();
      onChanged();
    } catch (err) {
      fail("Couldn’t give the seat", err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <Button
        onClick={() => {
          setOpen(true);
          void load();
        }}
      >
        Waiting for a bus
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Waiting for a bus"
        description="Students who asked for the school bus and have no seat yet."
      >
        {data === null ? (
          <p className="text-muted text-sm">Loading…</p>
        ) : data.students.length === 0 ? (
          <p className="text-sm">No student is waiting.</p>
        ) : (
          <ul className="grid gap-4">
            {data.students.map((s) => (
              <li key={s.id} className="border-line grid gap-2 border-b pb-3 text-sm">
                <p>
                  <span className="font-semibold">{s.name}</span> · {s.classSection}
                  {s.address ? <span className="text-muted block">{s.address}</span> : null}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Select
                    aria-label={`Route and stop for ${s.name}`}
                    className="min-w-0 flex-1"
                    value={choice[s.id] ?? ""}
                    onChange={(e) => setChoice((c) => ({ ...c, [s.id]: e.target.value }))}
                  >
                    <option value="">Choose route and stop</option>
                    {data.routes.flatMap((r) =>
                      r.stops.map((x) => (
                        <option key={x.id} value={`${r.id}|${x.id}`}>
                          {r.name} · {x.name}
                        </option>
                      )),
                    )}
                  </Select>
                  <Button disabled={!choice[s.id] || busy === s.id} onClick={() => assign(s.id)}>
                    {busy === s.id ? "Saving…" : "Give seat"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
