"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { ALWAYS_INCLUDED, FEATURES, FEATURE_KEYS, type Feature } from "@/config/features";
import { ROLE_LABEL, SCREENS } from "@/config/screens";
import { useData } from "../shared/use-data";

interface School {
  id: string;
  name: string;
  plan: string;
  disabled: string[];
}

const SAMPLE: { schools: School[] } = {
  schools: [
    { id: "s1", name: "Demo Public School (sample)", plan: "growth", disabled: [] },
    {
      id: "s2",
      name: "Green Valley School (sample)",
      plan: "starter",
      disabled: ["payroll", "transport"],
    },
  ],
};

/** The screens and people behind one feature, taken from the screen list so it cannot go stale. */
function reach(f: Feature) {
  const mine = SCREENS.filter((s) => f.screens.includes(s.id));
  return {
    screens: [...new Set(mine.map((s) => s.title))],
    users: [...new Set(mine.flatMap((s) => s.roles))].map((r) => ROLE_LABEL[r]),
  };
}

/** Every feature in detail, and for one chosen school, which of them it gets. */
export function PlatformFeatures() {
  const data = useData<{ schools: School[] }>("/platform/features", SAMPLE);
  const [schoolId, setSchoolId] = useState("");
  // Unsaved choices, per school; a school without an entry shows what is saved.
  const [draft, setDraft] = useState<Record<string, string[]>>({});

  if (data.error) return <ErrorState message={data.error.message} onRetry={data.reload} />;
  if (!data.data) return <LoadingBlock label="Loading features" />;
  const school = data.data.schools.find((s) => s.id === schoolId);
  const off = school ? (draft[school.id] ?? school.disabled) : [];
  const changed = !!school && [...off].sort().join() !== [...school.disabled].sort().join();
  const setOff = (next: string[]) => school && setDraft((d) => ({ ...d, [school.id]: next }));

  const save = async () => {
    if (!school) return;
    const ok = await data.send(
      "PUT",
      `/platform/schools/${school.id}/features`,
      { disabled: off },
      (current) => ({
        schools: current.schools.map((s) => (s.id === school.id ? { ...s, disabled: off } : s)),
      }),
      "Features saved.",
    );
    if (ok)
      setDraft((d) => Object.fromEntries(Object.entries(d).filter(([id]) => id !== school.id)));
  };

  return (
    <>
      <PageHeader
        title="Features"
        description="What each feature does, and which ones a school gets. Plans will be added later."
      />
      <Card className="mb-5 grid gap-3">
        <Field id="pf-school" label="School">
          {(a) => (
            <Select {...a} value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              <option value="">Only read the feature list</option>
              {data.data!.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.plan})
                </option>
              ))}
            </Select>
          )}
        </Field>
        {school ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="mr-auto font-semibold" role="status">
              {FEATURES.length - off.length} of {FEATURES.length} switched on
              {changed ? " (not saved)" : ""}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setOff([])}>
              All on
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOff([...FEATURE_KEYS])}>
              All off
            </Button>
            <Button size="sm" disabled={!changed || data.busy} onClick={save}>
              {data.busy ? "Saving…" : "Save"}
            </Button>
          </div>
        ) : null}
      </Card>

      <Card className="mb-5">
        <h2 className="text-ink text-lg font-semibold">Always included</h2>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {ALWAYS_INCLUDED.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </Card>

      <ul className="grid items-start gap-3 lg:grid-cols-2">
        {FEATURES.map((f) => {
          const { screens, users } = reach(f);
          const on = !off.includes(f.key);
          return (
            <li key={f.key} className="border-line bg-surface shadow-card rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-ink font-semibold">{f.title}</h2>
                  <p className="text-muted mt-1 text-sm">{f.summary}</p>
                </div>
                {school ? (
                  <label className="flex min-h-11 flex-none items-center gap-2 text-sm font-semibold">
                    <input
                      type="checkbox"
                      role="switch"
                      className="size-5"
                      aria-label={`${f.title} for ${school.name}`}
                      checked={on}
                      onChange={() => setOff(on ? [...off, f.key] : off.filter((k) => k !== f.key))}
                    />
                    {on ? "On" : "Off"}
                  </label>
                ) : null}
              </div>
              <details className="mt-2 text-sm">
                <summary className="text-accent-ink cursor-pointer font-semibold">Details</summary>
                <ul className="mt-2 list-disc pl-5">
                  {f.includes.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
                {screens.length ? (
                  <p className="mt-2">
                    <span className="font-semibold">Screens:</span> {screens.join(", ")}
                  </p>
                ) : null}
                {users.length ? (
                  <p className="mt-1">
                    <span className="font-semibold">Used by:</span> {users.join(", ")}
                  </p>
                ) : null}
              </details>
            </li>
          );
        })}
      </ul>
    </>
  );
}
