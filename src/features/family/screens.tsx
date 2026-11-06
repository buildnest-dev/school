"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Bell, CalendarDays, IndianRupee, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BarList, DevNote, PageHeader, StatGrid } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { useSession } from "@/hooks/use-session";
import type { CertificateType } from "@/types";
import { LedgerTable } from "../school/operations";
import { firstName, fmtDate, rupees } from "../shared/format";
import { ChildPage, useActiveChild } from "./child";

const ICON = { homework: Pencil, fee: IndianRupee, notice: Bell, event: CalendarDays } as const;

/** Parent and student home: today's briefing in plain language. */
export function FamilyHome() {
  const s = useServices();
  const { user } = useSession();
  const a = useActiveChild();
  const briefing = useAsync(
    () => (a.child ? s.family.briefing(a.child.id) : Promise.resolve(undefined)),
    [s, a.child?.id],
  );
  if (a.error) return <ErrorState message={a.error.message} onRetry={a.reload} />;
  if (!a.child || !briefing.data) return <LoadingBlock />;
  const isParent = user?.role === "parent";
  return (
    <ChildPage
      title={
        isParent ? `Hello, ${firstName(user?.name ?? "")}` : `Hi, ${a.child.name.split(" ")[0]}`
      }
      description={isParent ? "Today for" : "Here is your day."}
    >
      {() => (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title={briefing.data!.headline} hint="Your daily briefing" />
            <ul className="grid gap-3">
              {briefing
                .data!.items.filter((i) => isParent || i.kind !== "fee")
                .map((i) => {
                  const I = ICON[i.kind];
                  return (
                    <li key={i.id} className="flex items-start gap-3 text-base">
                      <span className="bg-paper-2 grid size-10 flex-none place-items-center rounded-full">
                        <I className="size-5" aria-hidden="true" />
                      </span>
                      <span className="pt-1.5">{i.text}</span>
                    </li>
                  );
                })}
            </ul>
          </Card>
          <div className="grid content-start gap-3">
            {(isParent
              ? [
                  ["/parent/attendance", "Attendance"],
                  ["/parent/homework", "Homework"],
                  ["/parent/results", "Results"],
                  ["/parent/fees", "Fees"],
                  ...(env.dataSource === "api" ? [] : [["/parent/ptm", "Meet a teacher"]]),
                ]
              : [
                  ["/student/timetable", "Today’s timetable"],
                  ["/student/homework", "Homework"],
                  ...(env.dataSource === "api" ? [] : [["/student/exams", "Exams"]]),
                  ["/student/results", "Results"],
                ]
            ).map(([href, label]) => (
              <Link
                key={href}
                href={href!}
                className="border-line bg-surface hover:border-ink flex min-h-14 items-center justify-between rounded-lg border px-4 text-lg font-semibold"
              >
                {label}
                <span aria-hidden="true">›</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </ChildPage>
  );
}

export function FamilyAttendance() {
  const s = useServices();
  return (
    <ChildPage title="Attendance" description="Days present, absent and late for">
      {(id) => <AttendanceBody id={id} s={s} />}
    </ChildPage>
  );
}
function AttendanceBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const d = useAsync(() => s.family.attendance(id), [s, id]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  const total = d.data.presentDays + d.data.absentDays + d.data.lateDays;
  return (
    <>
      <StatGrid
        stats={[
          { label: "Present", value: String(d.data.presentDays) },
          { label: "Absent", value: String(d.data.absentDays) },
          { label: "Late", value: String(d.data.lateDays) },
          {
            label: "Attendance",
            value: total ? `${Math.round((d.data.presentDays / total) * 100)}%` : "Not marked yet",
          },
        ]}
      />
      <Card className="mt-5 max-w-xl">
        <CardHeader title="Recent days" />
        <ul className="grid gap-2">
          {d.data.recent.map((r) => (
            <li
              key={r.date}
              className="border-line flex items-center justify-between border-b pb-2 last:border-b-0"
            >
              <span>{fmtDate(r.date)}</span>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

export function FamilyHomework() {
  const s = useServices();
  return (
    <ChildPage title="Homework" description="What is due for">
      {(id) => <HomeworkBody id={id} s={s} />}
    </ChildPage>
  );
}
function HomeworkBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const d = useAsync(() => s.family.homework(id), [s, id]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  if (d.data.length === 0) return <EmptyState title="No homework right now" />;
  return (
    <ul className="grid max-w-2xl gap-3">
      {d.data.map((h) => (
        <li key={h.id}>
          <Card className="flex flex-wrap items-center justify-between gap-3">
            <span>
              <span className="block text-lg font-semibold">{h.title}</span>
              <span className="text-muted text-sm">
                {h.subject} · due {fmtDate(h.due)}
              </span>
            </span>
            <StatusBadge
              status={
                h.status === "pending"
                  ? "pending"
                  : h.status === "submitted"
                    ? "submitted"
                    : "approved"
              }
            />
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function FamilyResults() {
  const s = useServices();
  return (
    <ChildPage title="Results" description="Marks for">
      {(id) => <ResultsBody id={id} s={s} />}
    </ChildPage>
  );
}
function ResultsBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const d = useAsync(() => s.family.results(id), [s, id]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  return (
    <>
      <Card className="max-w-2xl">
        <BarList
          rows={d.data.map((r) => ({
            label: r.subject,
            pct: Math.round((r.marks / r.max) * 100),
            text: `${r.marks}/${r.max} · ${r.grade}`,
          }))}
        />
      </Card>
      <div className="mt-4 max-w-2xl">
        <DevNote>
          Report cards are published by the school through the backend. PDF report cards are not
          generated in this build.
        </DevNote>
      </div>
    </>
  );
}

export function FamilyFees() {
  const s = useServices();
  return (
    <ChildPage title="Fees" description="Fee ledger for">
      {(id) => <FeesBody id={id} s={s} />}
    </ChildPage>
  );
}
function FeesBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const d = useAsync(() => s.family.ledger(id), [s, id]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  const bal = d.data.at(-1)?.balance ?? 0;
  return (
    <>
      <Card className="mb-5 max-w-sm">
        <p className="text-muted text-sm">Balance due</p>
        <p className="font-display text-4xl tabular-nums">{rupees(bal)}</p>
        {bal > 0 ? (
          <p className="text-muted mt-1 text-sm">
            Online payment is not available yet. Please pay at the school office.
          </p>
        ) : (
          <StatusBadge status="paid" />
        )}
      </Card>
      <LedgerTable rows={d.data} />
    </>
  );
}

export function FamilyTimetable() {
  const s = useServices();
  return (
    <ChildPage title="Timetable" description="Today’s periods for">
      {(id) => <TimetableBody id={id} s={s} />}
    </ChildPage>
  );
}
function TimetableBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const d = useAsync(() => s.family.timetable(id), [s, id]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  return (
    <ol className="grid max-w-2xl gap-3">
      {d.data.map((p) => (
        <li key={p.period}>
          <Card className="flex items-center gap-4">
            <span className="bg-paper-2 grid size-12 flex-none place-items-center rounded-lg font-bold">
              {p.period}
            </span>
            <span>
              <span className="block text-lg font-semibold">{p.subject}</span>
              <span className="text-muted text-sm">
                {p.time} · {p.room}
                {p.teacher ? ` · ${p.teacher}` : ""}
              </span>
            </span>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function FamilyExams() {
  const s = useServices();
  return (
    <ChildPage title="Exams" description="Upcoming exams for">
      {(id) => <ExamsBody id={id} s={s} />}
    </ChildPage>
  );
}
function ExamsBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const d = useAsync(() => s.family.exams(id), [s, id]);
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock />;
  return (
    <ul className="grid max-w-2xl gap-3">
      {d.data.map((e) => (
        <li key={e.id}>
          <Card className="flex items-center justify-between gap-3">
            <span>
              <span className="block text-lg font-semibold">{e.subject}</span>
              <span className="text-muted text-sm">
                {e.kind} · {e.room}
              </span>
            </span>
            <span className="font-semibold">{fmtDate(e.date)}</span>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ParentPtm() {
  const s = useServices();
  const { toast } = useToast();
  const slots = useAsync(() => s.family.ptmSlots(), [s]);
  const [busy, setBusy] = useState<string | null>(null);
  const book = async (id: string) => {
    setBusy(id);
    try {
      const r = await s.family.bookPtm(id);
      toast({ title: "Slot booked", description: r.message });
      slots.reload();
    } catch (e) {
      toast({
        title: "Couldn’t book the slot",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };
  return (
    <>
      <PageHeader
        title="Meet a teacher"
        description="Choose a free slot for the parent-teacher meeting."
      />
      {slots.error ? (
        <ErrorState message={slots.error.message} onRetry={slots.reload} />
      ) : !slots.data ? (
        <LoadingBlock />
      ) : (
        <ul className="grid max-w-2xl gap-3">
          {slots.data.map((x) => (
            <li key={x.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block text-lg font-semibold">{x.teacher}</span>
                  <span className="text-muted text-sm">
                    {fmtDate(x.date)} · {x.time}
                  </span>
                </span>
                {x.booked ? (
                  <StatusBadge status="confirmed" />
                ) : (
                  <Button disabled={busy === x.id} onClick={() => book(x.id)}>
                    Book this slot
                  </Button>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 max-w-2xl">
        <DevNote>Booking is kept in the development mock. The teacher is not told.</DevNote>
      </div>
    </>
  );
}

/** The real backend issues bonafide, character and transfer certificates only. */
const CERTS: CertificateType[] =
  env.dataSource === "api"
    ? ["Bonafide", "Character", "Transfer"]
    : ["Bonafide", "Character", "Study", "Transfer"];
const reqSchema = z.object({
  type: z.enum(["Bonafide", "Character", "Study", "Transfer"]),
  purpose: z.string().trim().min(3, "Say what the certificate is for."),
});
type ReqForm = z.infer<typeof reqSchema>;

export function ParentCertificates() {
  const s = useServices();
  return (
    <ChildPage title="Certificates" description="Request a certificate for">
      {(id) => <CertBody id={id} s={s} />}
    </ChildPage>
  );
}
function CertBody({ id, s }: { id: string; s: ReturnType<typeof useServices> }) {
  const { toast } = useToast();
  const list = useAsync(() => s.family.certificateRequests(id), [s, id]);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ReqForm>({
    resolver: zodResolver(reqSchema),
    defaultValues: { type: "Bonafide", purpose: "" },
  });
  const onSubmit = async (v: ReqForm) => {
    try {
      const r = await s.family.requestCertificate(id, v.type, v.purpose);
      toast({ title: "Request recorded", description: r.message });
      reset();
      list.reload();
    } catch (e) {
      toast({
        title: "Couldn’t send the request",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid content-start gap-5">
        <Field id="pc-type" label="Which certificate?">
          {(a) => (
            <Select {...a} {...register("type")}>
              {CERTS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field id="pc-purpose" label="What is it for?" required error={errors.purpose?.message}>
          {(a) => <Input {...a} {...register("purpose")} />}
        </Field>
        <div>
          <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
            Send request
          </Button>
        </div>
        <DevNote>
          Requests go to the development mock only. The school does not receive them. Fees, approval
          and delivery are handled by the backend.
        </DevNote>
      </form>
      <Card>
        <CardHeader title="Your requests" />
        {!list.data ? (
          <LoadingBlock rows={2} />
        ) : list.data.length === 0 ? (
          <EmptyState
            title="No requests yet"
            hint="Requests you send show here with their status."
          />
        ) : (
          <ul className="grid gap-3">
            {list.data.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{r.type} certificate</span>
                  <span className="text-muted text-sm">Requested {fmtDate(r.requestedOn)}</span>
                </span>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
