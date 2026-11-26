"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

type Status = "done" | "missing" | "excused" | "pending";
interface Row {
  studentId: string;
  name: string;
  rollNo: number;
  status: Status;
  note: string | null;
}

const LABEL: Record<Status, string> = {
  pending: "Not checked",
  done: "Done",
  missing: "Not done",
  excused: "Excused",
};

function Roster({ id, done }: { id: string; done: () => void }) {
  const { toast } = useToast();
  const d = useAsync(() => apiRequest<{ roster: Row[] }>(`/homework/${id}`), [id]);
  const [changes, setChanges] = useState<Record<string, Status>>({});
  const [busy, setBusy] = useState(false);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  const roster = d.data.roster;
  const save = async () => {
    setBusy(true);
    try {
      await apiRequest(`/homework/${id}/completion`, {
        method: "PUT",
        body: {
          entries: roster
            .filter((r) => changes[r.studentId])
            .map((r) => ({
              studentId: r.studentId,
              status: changes[r.studentId],
              ...(r.note ? { note: r.note } : {}),
            })),
        },
      });
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
  return (
    <div className="grid gap-3">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setChanges(Object.fromEntries(roster.map((r) => [r.studentId, "done"])))}
        >
          Mark everyone done
        </Button>
      </div>
      <ul className="grid max-h-80 gap-2 overflow-y-auto">
        {roster.map((r) => (
          <li key={r.studentId} className="flex items-center justify-between gap-3 text-sm">
            <span>
              {r.rollNo}. {r.name}
            </span>
            <Select
              aria-label={`Homework of ${r.name}`}
              className="max-w-40"
              value={changes[r.studentId] ?? r.status}
              onChange={(e) =>
                setChanges((c) => ({ ...c, [r.studentId]: e.target.value as Status }))
              }
            >
              {(Object.keys(LABEL) as Status[]).map((s) => (
                <option key={s} value={s}>
                  {LABEL[s]}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
      <div>
        <Button onClick={save} disabled={busy || !Object.keys(changes).length}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}

/** The teacher marks who has done a published piece of homework. */
export function HomeworkCheck({
  id,
  title,
  onSaved,
}: {
  id: string;
  title: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Mark who has done it
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={title}>
        {open ? (
          <Roster
            id={id}
            done={() => {
              setOpen(false);
              onSaved();
            }}
          />
        ) : null}
      </Dialog>
    </>
  );
}
