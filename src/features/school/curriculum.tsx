"use client";

import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

interface ClassRow {
  id: string;
  name: string;
  stage: string;
  sections: { id: string; name: string }[];
  subjects: { id: string; name: string }[];
}

/** Classes with their sections and subjects; subjects can be added to a class. */
export function Curriculum() {
  const { toast } = useToast();
  const classes = useAsync(() => apiRequest<ClassRow[]>("/classes"), []);
  const [busy, setBusy] = useState<string | null>(null);
  const [text, setText] = useState<Record<string, string>>({});

  const createStandard = async () => {
    setBusy("standard");
    try {
      await apiRequest("/classes/standard", { method: "POST", body: {} });
      toast({ title: "Classes created", description: "Nursery to Class 12, section A." });
      classes.reload();
    } catch (e) {
      toast({
        title: "Couldn’t create the classes",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const addSubjects = async (e: FormEvent, c: ClassRow) => {
    e.preventDefault();
    const names = (text[c.id] ?? "")
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length) return;
    setBusy(c.id);
    try {
      await apiRequest(`/classes/${c.id}/subjects`, { method: "POST", body: { names } });
      setText((t) => ({ ...t, [c.id]: "" }));
      toast({ title: "Subjects saved", description: c.name });
      classes.reload();
    } catch (err) {
      toast({
        title: "Couldn’t add the subjects",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Classes, subjects & syllabus"
        description="Each class with its sections and subjects."
      />
      {classes.error ? (
        <ErrorState message={classes.error.message} onRetry={classes.reload} />
      ) : !classes.data ? (
        <LoadingBlock />
      ) : classes.data.length === 0 ? (
        <Card className="max-w-xl">
          <p className="text-sm">
            This school has no classes yet. Create the standard ones (Nursery to Class 12, section
            A) to start.
          </p>
          <div className="mt-3">
            <Button onClick={createStandard} disabled={busy === "standard"}>
              {busy === "standard" ? "Creating…" : "Create classes"}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid max-w-3xl gap-3">
          {classes.data.map((c) => (
            <Card key={c.id} className="grid gap-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-semibold">{c.name}</h2>
                <span className="text-muted text-sm">
                  Sections: {c.sections.map((s) => s.name).join(", ") || "none"}
                </span>
              </div>
              <p className="text-sm">
                {c.subjects.length ? (
                  c.subjects.map((s) => s.name).join(" · ")
                ) : (
                  <span className="text-muted">No subjects yet.</span>
                )}
              </p>
              <form
                onSubmit={(e) => addSubjects(e, c)}
                className="flex flex-wrap items-center gap-2"
                noValidate
              >
                <label htmlFor={`sub-${c.id}`} className="sr-only">
                  Add subjects to {c.name}
                </label>
                <Input
                  id={`sub-${c.id}`}
                  className="max-w-xs"
                  placeholder="Add subjects, separated by commas"
                  autoComplete="off"
                  value={text[c.id] ?? ""}
                  onChange={(e) => setText((t) => ({ ...t, [c.id]: e.target.value }))}
                />
                <Button
                  type="submit"
                  variant="ghost"
                  disabled={busy === c.id || !text[c.id]?.trim()}
                >
                  Add
                </Button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
