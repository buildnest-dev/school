"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { DevNote, PageHeader, useUnsavedWarning } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { fmtDate } from "../shared/format";
import { homeworkSchema, type HomeworkForm } from "./schemas";

export function HomeworkList() {
  const s = useServices();
  const list = useAsync(() => s.homework.list(), [s]);
  return (
    <>
      <PageHeader
        title="Homework"
        description="Homework you have set for your classes."
        actions={
          <Button asChild>
            <Link href="/teacher/homework/new">Add Homework</Link>
          </Button>
        }
      />
      {list.error ? (
        <ErrorState message={list.error.message} onRetry={list.reload} />
      ) : !list.data ? (
        <LoadingBlock />
      ) : list.data.length === 0 ? (
        <EmptyState
          title="No homework yet"
          hint="Set homework for a class and students and parents will see it."
          action={
            <Button asChild>
              <Link href="/teacher/homework/new">Add Homework</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3">
          {list.data.map((h) => (
            <li key={h.id}>
              <Card className="grid gap-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{h.title}</p>
                    <p className="text-muted text-sm">
                      {h.classLabel} · {h.subject} · due {fmtDate(h.due)}
                    </p>
                  </div>
                  <StatusBadge status={h.status} />
                </div>
                <p className="text-sm">{h.instructions}</p>
                {h.status === "published" ? (
                  <p className="text-muted text-sm">
                    {h.submitted} of {h.total} students have handed in
                  </p>
                ) : (
                  <p className="text-muted text-sm">Draft: students can’t see this yet.</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function HomeworkNew() {
  const s = useServices();
  const router = useRouter();
  const { toast } = useToast();
  const today = todayIso();
  const classes = useAsync(() => s.teacher.classes(), [s]);
  const schema = useMemo(() => homeworkSchema(today), [today]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    getValues,
    trigger,
  } = useForm<HomeworkForm>({
    resolver: zodResolver(schema),
    defaultValues: { classId: "", title: "", instructions: "", due: "" },
  });
  useUnsavedWarning(isDirty && !isSubmitting);

  const save = async (publish: boolean) => {
    const ok = await trigger();
    if (!ok) return;
    const v = getValues();
    try {
      const res = await s.homework.create({ ...v, publish });
      toast({ title: publish ? "Homework published" : "Draft saved", description: res.message });
      router.push("/teacher/homework");
    } catch (e) {
      toast({
        title: "Couldn’t save the homework",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };

  if (classes.error) return <ErrorState message={classes.error.message} onRetry={classes.reload} />;
  if (!classes.data) return <LoadingBlock rows={3} />;

  return (
    <>
      <PageHeader
        title="Add Homework"
        description="Choose a class, say what to do and when it is due."
      />
      <form noValidate onSubmit={handleSubmit(() => save(true))} className="grid max-w-2xl gap-5">
        <Field id="hw-class" label="Class" required error={errors.classId?.message}>
          {(a) => (
            <Select {...a} {...register("classId")}>
              <option value="">Choose a class</option>
              {classes.data!.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label} · {c.subject}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          id="hw-title"
          label="Title"
          required
          error={errors.title?.message}
          hint="For example: Chapter 4 questions"
        >
          {(a) => <Input {...a} {...register("title")} />}
        </Field>
        <Field
          id="hw-instructions"
          label="What should students do?"
          required
          error={errors.instructions?.message}
        >
          {(a) => <Textarea {...a} {...register("instructions")} />}
        </Field>
        <Field id="hw-due" label="Due date" required error={errors.due?.message}>
          {(a) => <Input type="date" min={today} {...a} {...register("due")} />}
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={isSubmitting} className="min-h-12 px-6">
            Publish homework
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isSubmitting}
            onClick={() => save(false)}
            className="min-h-12"
          >
            Save as draft
          </Button>
          <Button asChild variant="ghost" className="min-h-12">
            <Link href="/teacher/homework">Cancel</Link>
          </Button>
        </div>
        <DevNote>
          Publishing here updates the development mock only. Students and parents are not notified.
        </DevNote>
      </form>
    </>
  );
}
