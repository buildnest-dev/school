"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui/field";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

interface Found {
  id: string;
  name: string;
  classSection?: string;
  admissionNo?: string;
  role?: string;
}

/** Find one student or staff member by name, for forms that need a person. */
export function PersonSearch({
  kind,
  value,
  onChange,
}: {
  kind: "students" | "staff";
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const found = useAsync(
    () =>
      apiRequest<{ items: Found[] }>(`/${kind}`, {
        query: kind === "students" ? { q, pageSize: 50 } : { status: "active" },
      }).then((r) =>
        kind === "staff" && q
          ? r.items.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
          : r.items,
      ),
    [kind, q],
  );
  const label = kind === "students" ? "Student" : "Staff member";
  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5 text-sm font-semibold">
        Search by name
        <Input
          value={q}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            onChange("");
          }}
        />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        {label}
        <Select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">
            {found.loading ? "Searching…" : `Choose (${found.data?.length ?? 0} found)`}
          </option>
          {found.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {[p.name, p.classSection, p.admissionNo ?? p.role].filter(Boolean).join(" · ")}
            </option>
          ))}
        </Select>
      </label>
      {found.error ? (
        <p role="alert" className="text-bad text-sm">
          {found.error.message}
        </p>
      ) : null}
    </div>
  );
}
