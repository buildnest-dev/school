"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { BarList, DevNote, PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import type { RosterStudent } from "@/types";
import { fmtDate, todayLabel } from "../shared/format";
import { LEAVE_TYPES, leaveSchema, type LeaveForm } from "./schemas";

export function TeacherToday() {
  const s = useServices();
  const t = useAsync(() => s.teacher.timetable(), [s]);
  return (
    <>
      <PageHeader
        eyebrow={todayLabel(todayIso())}
        title="Today’s timetable"
        description="Your periods for today."
      />
      {t.error ? (
        <ErrorState message={t.error.message} onRetry={t.reload} />
      ) : !t.data ? (
        <LoadingBlock />
      ) : (
        <ol className="grid gap-3">
          {t.data.map((p) => (
            <li key={p.period}>
              <Card className="flex items-center gap-4">
                <span className="bg-paper-2 text-ink grid size-14 flex-none place-items-center rounded-lg text-lg font-bold">
                  {p.period}
                </span>
                <span className="grow">
                  <span className="block text-lg font-semibold">
                    {p.subject}
                    {p.classLabel !== "—" ? ` · ${p.classLabel}` : ""}
                  </span>
                  <span className="text-muted text-sm">
                    {p.time} · {p.room}
                  </span>
                </span>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}

export function TeacherClasses() {
  const s = useServices();
  const c = useAsync(() => s.teacher.classes(), [s]);
  const [open, setOpen] = useState<{ label: string; roster: RosterStudent[] } | null>(null);
  const showRoster = async (id: string, label: string) => {
    const sheet = await s.attendance.getSheet(id, todayIso());
    setOpen({ label, roster: sheet?.roster ?? [] });
  };
  return (
    <>
      <PageHeader title="My classes" description="Classes you teach." />
      {c.error ? (
        <ErrorState message={c.error.message} onRetry={c.reload} />
      ) : !c.data ? (
        <LoadingBlock />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {c.data.map((x) => (
            <li key={x.id}>
              <Card className="grid gap-3">
                <div>
                  <p className="text-lg font-semibold">{x.label}</p>
                  <p className="text-muted text-sm">
                    {x.subject} · {x.studentCount} students · {x.room}
                  </p>
                </div>
                <div>
                  <Button variant="ghost" onClick={() => showRoster(x.id, x.label)}>
                    See class list
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={open !== null}
        onOpenChange={(o) => !o && setOpen(null)}
        title={`${open?.label ?? ""} · class list`}
      >
        <ol className="grid gap-1 text-sm">
          {open?.roster.map((r) => (
            <li key={r.id} className="border-line border-b py-1.5">
              <span className="text-muted mr-2 tabular-nums">{r.rollNo}</span>
              {r.name}
            </li>
          ))}
        </ol>
      </Dialog>
    </>
  );
}

export function Syllabus() {
  const s = useServices();
  const d = useAsync(() => s.teacher.syllabus(), [s]);
  return (
    <>
      <PageHeader
        title="Syllabus progress"
        description="How much of the term’s syllabus each class has covered (sample)."
      />
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={2} />
      ) : (
        <Card className="max-w-2xl">
          <BarList rows={d.data.map((x) => ({ label: `${x.classLabel}`, pct: x.pct }))} />
        </Card>
      )}
    </>
  );
}

export function LeavePage() {
  const s = useServices();
  const { toast } = useToast();
  const today = todayIso();
  const schema = useMemo(() => leaveSchema(today), [today]);
  const mine = useAsync(() => s.teacher.leaves(), [s]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeaveForm>({
    resolver: zodResolver(schema),
    defaultValues: { from: "", to: "", type: "Casual leave", reason: "" },
  });
  const onSubmit = async (v: LeaveForm) => {
    try {
      const res = await s.leave.request(v);
      toast({ title: "Leave request sent", description: res.message });
      reset();
      mine.reload();
    } catch (e) {
      toast({
        title: "Couldn’t send the request",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <>
      <PageHeader title="Request Leave" description="Tell the office when you will be away." />
      <div className="grid gap-6 lg:grid-cols-2">
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="lv-from" label="First day" required error={errors.from?.message}>
              {(a) => <Input type="date" min={today} {...a} {...register("from")} />}
            </Field>
            <Field id="lv-to" label="Last day" required error={errors.to?.message}>
              {(a) => <Input type="date" min={today} {...a} {...register("to")} />}
            </Field>
          </div>
          <Field id="lv-type" label="Type of leave">
            {(a) => (
              <Select {...a} {...register("type")}>
                {LEAVE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </Select>
            )}
          </Field>
          <Field id="lv-reason" label="Reason" required error={errors.reason?.message}>
            {(a) => <Textarea {...a} {...register("reason")} />}
          </Field>
          <div>
            <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
              Send request
            </Button>
          </div>
          <DevNote>
            This records the request in the development mock only. No one has been asked to approve
            it.
          </DevNote>
        </form>
        <Card>
          <CardHeader title="Your requests" />
          {mine.error ? (
            <ErrorState message={mine.error.message} onRetry={mine.reload} />
          ) : !mine.data ? (
            <LoadingBlock rows={2} />
          ) : mine.data.length === 0 ? (
            <EmptyState
              title="No requests yet"
              hint="Requests you send will show here with their status."
            />
          ) : (
            <ul className="grid gap-3">
              {mine.data.map((l) => (
                <li
                  key={l.id}
                  className="border-line flex items-center justify-between gap-3 border-b pb-3 last:border-b-0"
                >
                  <span>
                    <span className="block font-semibold">{l.type}</span>
                    <span className="text-muted text-sm">
                      {fmtDate(l.from)} to {fmtDate(l.to)}
                    </span>
                  </span>
                  <StatusBadge status={l.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
