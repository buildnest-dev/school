"use client";

import { ArrowRight, ClipboardList, Pencil, Plane } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { env, todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { todayLabel } from "../shared/format";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

export function TeacherHome() {
  const s = useServices();
  const home = useAsync(() => s.teacher.home(), [s]);
  const classes = useAsync(() => s.teacher.classes(), [s]);

  if (home.error) return <ErrorState message={home.error.message} onRetry={home.reload} />;
  if (!home.data || !classes.data) return <LoadingBlock label="Loading your day" />;
  const h = home.data;
  const next = classes.data.find((c) => c.id === h.nextAttendanceClassId);

  return (
    <>
      <PageHeader
        eyebrow={todayLabel(todayIso())}
        title={`${greeting()}, ${h.greetingName}.`}
        description={`You have ${h.classesToday} classes today.`}
      />

      {next ? (
        <Card className="border-ink bg-ink on-dark mb-6 flex flex-wrap items-center justify-between gap-4 p-6 text-white">
          <div>
            <p className="text-on-dark text-sm">
              Next up · {next.period} · {next.time}
            </p>
            <p className="font-display mt-1 text-2xl">Mark Attendance — {next.label}</p>
          </div>
          <Button asChild variant="light" className="min-h-14 px-8 text-base">
            <Link href={`/teacher/attendance/${next.id}`}>
              Mark Attendance <ArrowRight className="size-5" aria-hidden="true" />
            </Link>
          </Button>
        </Card>
      ) : (
        <Card className="mb-6">
          <p className="font-semibold">All of today’s attendance is done. Thank you.</p>
        </Card>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {[
          {
            href: "/teacher/homework/new",
            icon: Pencil,
            title: "Add Homework",
            hint: "Set work for a class",
          },
          {
            href: "/teacher/marks",
            icon: ClipboardList,
            title: "Enter Marks",
            hint: "For your classes",
          },
          ...(env.dataSource === "api"
            ? []
            : [
                {
                  href: "/teacher/leave",
                  icon: Plane,
                  title: "Request Leave",
                  hint: "Ask for time off",
                },
              ]),
        ].map(({ href, icon: I, title, hint }) => (
          <Link
            key={href}
            href={href}
            className="border-line bg-surface hover:border-ink flex min-h-20 items-center gap-4 rounded-lg border p-4 transition-colors"
          >
            <span className="bg-paper-2 text-ink grid size-12 flex-none place-items-center rounded-lg">
              <I className="size-6" aria-hidden="true" />
            </span>
            <span>
              <span className="block text-lg font-semibold">{title}</span>
              <span className="text-muted text-sm">{hint}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today’s classes"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/teacher/today">Full timetable</Link>
              </Button>
            }
          />
          <ul className="grid gap-3">
            {classes.data.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">
                    {c.label} · {c.subject}
                  </span>
                  <span className="text-muted text-sm">
                    {c.period} · {c.time} · {c.room}
                  </span>
                </span>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/teacher/attendance/${c.id}`}>Attendance</Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Still to do" hint="Small tasks waiting for you" />
          {h.pending.length === 0 ? (
            <EmptyState title="Nothing waiting" hint="You’re all caught up." />
          ) : (
            <ul className="grid gap-2">
              {h.pending.map((p) => (
                <li key={p.id}>
                  <Link
                    href={p.href}
                    className="hover:bg-paper flex min-h-11 items-center justify-between gap-3 rounded-md px-2 py-1.5"
                  >
                    <span>{p.label}</span>
                    <ArrowRight className="text-muted size-4 flex-none" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="School notices"
            action={
              <Button asChild variant="ghost" size="sm">
                <Link href="/teacher/notices">All notices</Link>
              </Button>
            }
          />
          <ul className="grid gap-2">
            {h.notices.map((n) => (
              <li key={n.id} className="border-line border-b pb-2 last:border-b-0">
                {n.title}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
