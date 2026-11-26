"use client";

import { Download, Printer } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import {
  MODULE_GROUPS,
  moduleByKey,
  moduleRights,
  modulesFor,
  type ModuleDef,
  type ModuleField,
} from "@/config/modules";
import { registerOn } from "@/config/features";
import { AREA_ROOT, ROLE_AREA } from "@/config/screens";
import { todayIso } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { downloadCsv } from "./csv";
import { fmtDate } from "./format";
import type { ScreenProps } from "./planned-screen";
import { sampleId, useData } from "./use-data";

/** The list of registers the signed-in person can open, grouped. */
export function RegisterHub() {
  const { user } = useSession();
  const counts = useData<{ key: string; waiting: number }[]>("/records", []);
  const [q, setQ] = useState("");
  if (!user) return null;
  const waiting = new Map((counts.data ?? []).map((c) => [c.key, c.waiting]));
  const root = AREA_ROOT[ROLE_AREA[user.role]];
  const all = modulesFor(user.role).filter(
    (m) =>
      registerOn(m.key, user.disabledFeatures) &&
      `${m.title} ${m.description}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <>
      <PageHeader title="Registers" description="Records the school keeps, in one place." />
      <Input
        aria-label="Search registers"
        placeholder="Search, for example visitor, repair, club"
        className="mb-6 max-w-md"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {!all.length ? <EmptyState title="Nothing matches" /> : null}
      <div className="grid gap-8">
        {MODULE_GROUPS.map((group) => {
          const items = all.filter((m) => m.group === group);
          if (!items.length) return null;
          return (
            <section key={group}>
              <h2 className="text-ink mb-3 text-xl">{group}</h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((m) => (
                  <li key={m.key}>
                    <Link
                      href={`${root}/records/${m.key}`}
                      className="border-line bg-surface shadow-card hover:border-gold block h-full rounded-2xl border p-4 transition-colors"
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="text-ink font-semibold">{m.title}</span>
                        {waiting.get(m.key) ? (
                          <span className="bg-accent-light text-ink rounded-full px-2 text-xs font-bold">
                            {waiting.get(m.key)}
                          </span>
                        ) : null}
                      </span>
                      <span className="text-muted mt-1 block text-sm">{m.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}

interface Item {
  id: string;
  title: string;
  status: string;
  data: Record<string, string>;
  studentId: string | null;
  student: string;
  staffId: string | null;
  staff: string;
  by: string;
  createdOn: string;
  canEdit: boolean;
}
interface Listing {
  items: Item[];
  students: { id: string; name: string }[];
  staff: { id: string; name: string }[];
}

/** One made-up record, so the sample build shows what the register looks like. */
function sampleListing(m: ModuleDef): Listing {
  const data = Object.fromEntries(
    m.fields.map((f) => [
      f.key,
      f.type === "select"
        ? f.options![0]!
        : f.type === "date"
          ? "2026-10-26"
          : f.type === "time"
            ? f.key === "to" || f.key === "out"
              ? "11:00"
              : "10:00"
            : f.type === "number"
              ? "1"
              : f.type === "link"
                ? "https://example.com"
                : f.staffOnly || f.private
                  ? ""
                  : "Sample entry",
    ]),
  );
  return {
    items: [
      {
        id: "sample-0",
        title: `Sample: ${m.title.toLowerCase()}`,
        status: m.statuses[0]!,
        data,
        studentId: m.student ? "c-aarav" : null,
        student: m.student ? "Aarav Mehta · 7B" : "",
        staffId: m.staff ? "s-1" : null,
        staff: m.staff ? "Kavita Iyer" : "",
        by: "School office",
        createdOn: "2026-10-26",
        canEdit: true,
      },
    ],
    students: [{ id: "c-aarav", name: "Aarav Mehta · 7B" }],
    staff: [{ id: "s-1", name: "Kavita Iyer" }],
  };
}

const words = (v: string) => v.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: ModuleField;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field id={`rec-${field.key}`} label={field.label} required={field.required}>
      {(a) =>
        field.type === "textarea" ? (
          <Textarea {...a} value={value} onChange={(e) => onChange(e.target.value)} />
        ) : field.type === "select" ? (
          <Select {...a} value={value} onChange={(e) => onChange(e.target.value)}>
            {field.required ? null : <option value="">–</option>}
            {field.options!.map((o) => (
              <option key={o} value={o}>
                {words(o)}
              </option>
            ))}
          </Select>
        ) : (
          <Input
            {...a}
            type={field.type === "link" ? "url" : (field.type ?? "text")}
            step={field.type === "number" ? "0.01" : undefined}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        )
      }
    </Field>
  );
}

function RecordForm({
  def,
  manage,
  listing,
  item,
  busy,
  onSave,
}: {
  def: ModuleDef;
  manage: boolean;
  listing: Listing;
  item?: Item;
  busy: boolean;
  onSave: (v: {
    title: string;
    studentId: string;
    staffId: string;
    status: string;
    data: Record<string, string>;
  }) => void;
}) {
  const fields = def.fields.filter((f) => manage || !(f.staffOnly || f.private));
  const [v, setV] = useState(() => ({
    title: item?.title ?? "",
    studentId: item?.studentId ?? listing.students[0]?.id ?? "",
    staffId: item?.staffId ?? (def.staff === "required" ? (listing.staff[0]?.id ?? "") : ""),
    status: item?.status ?? def.statuses[0]!,
    data: Object.fromEntries(
      fields.map((f) => [
        f.key,
        item?.data[f.key] ??
          (f.type === "select" && f.required !== false && !f.staffOnly
            ? f.options![0]!
            : f.type === "date" && f.required
              ? todayIso()
              : ""),
      ]),
    ) as Record<string, string>,
  }));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave(v);
  };
  return (
    <form onSubmit={submit} className="grid gap-3">
      <Field id="rec-title" label={def.titleLabel} required>
        {(a) => (
          <Input {...a} value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
        )}
      </Field>
      {!item && def.student ? (
        <Field id="rec-student" label="Student" required={def.student === "required"}>
          {(a) => (
            <Select
              {...a}
              value={v.studentId}
              onChange={(e) => setV({ ...v, studentId: e.target.value })}
            >
              {def.student === "optional" ? <option value="">No student</option> : null}
              {listing.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {!item && def.staff && manage ? (
        <Field id="rec-staff" label="Staff member" required={def.staff === "required"}>
          {(a) => (
            <Select
              {...a}
              value={v.staffId}
              onChange={(e) => setV({ ...v, staffId: e.target.value })}
            >
              {def.staff === "optional" ? <option value="">No one yet</option> : null}
              {listing.staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      {fields.map((f) => (
        <FieldInput
          key={f.key}
          field={f}
          value={v.data[f.key] ?? ""}
          onChange={(x) => setV({ ...v, data: { ...v.data, [f.key]: x } })}
        />
      ))}
      {manage ? (
        <Field id="rec-status" label="Stage">
          {(a) => (
            <Select
              {...a}
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value })}
            >
              {def.statuses.map((s) => (
                <option key={s} value={s}>
                  {words(s)}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Button type="submit" disabled={busy || v.title.trim().length < 2}>
        Save
      </Button>
    </form>
  );
}

/** One register: search, filter, add, change, print and download. */
export function RegisterPage({ params }: ScreenProps) {
  const def = moduleByKey(params.module ?? "");
  const { user } = useSession();
  if (!user) return null;
  const rights = def && moduleRights(def, user.role);
  if (!def || !rights?.any)
    return <EmptyState title="Register not found" hint="It may not be open to your role." />;
  return <Register key={def.key} def={def} manage={rights.manage} submit={rights.submit} />;
}

function Register({ def, manage, submit }: { def: ModuleDef; manage: boolean; submit: boolean }) {
  const path = `/records/${def.key}`;
  const d = useData<Listing>(path, sampleListing(def));
  const [open, setOpen] = useState<Item | "new" | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [removing, setRemoving] = useState<Item | null>(null);
  const items = (d.data?.items ?? []).filter(
    (i) =>
      (!status || i.status === status) &&
      `${i.title} ${i.student} ${i.staff} ${Object.values(i.data).join(" ")}`
        .toLowerCase()
        .includes(q.trim().toLowerCase()),
  );
  const label = (k: string) => def.fields.find((f) => f.key === k)?.label ?? k;
  const csv = () =>
    downloadCsv(`${def.key}.csv`, [
      [def.titleLabel, "Stage", "Student", "Staff", ...def.fields.map((f) => f.label), "Added by"],
      ...items.map((i) => [
        i.title,
        words(i.status),
        i.student,
        i.staff,
        ...def.fields.map((f) => i.data[f.key] ?? ""),
        i.by,
      ]),
    ]);

  return (
    <>
      <PageHeader title={def.title} description={def.description} />
      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        {manage || submit ? <Button onClick={() => setOpen("new")}>Add new</Button> : null}
        <Input
          aria-label="Search"
          placeholder="Search"
          className="max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select
          aria-label="Stage"
          className="w-auto"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All stages</option>
          {def.statuses.map((s) => (
            <option key={s} value={s}>
              {words(s)}
            </option>
          ))}
        </Select>
        <span className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={csv} disabled={!items.length}>
            <Download className="size-4" aria-hidden="true" /> CSV
          </Button>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Print
          </Button>
        </span>
      </div>
      {d.error ? (
        <ErrorState message={d.error.message} onRetry={d.reload} />
      ) : !d.data ? (
        <LoadingBlock rows={3} />
      ) : !items.length ? (
        <EmptyState
          title="No records"
          hint={manage || submit ? "Use “Add new” to make the first one." : undefined}
        />
      ) : (
        <ul className="grid gap-3">
          {items.map((i) => (
            <li key={i.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink font-semibold">{i.title}</p>
                    <p className="text-muted text-sm">
                      {[i.student, i.staff, i.by, fmtDate(i.createdOn)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <StatusBadge status={i.status} />
                </div>
                <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {Object.entries(i.data)
                    .filter(([, value]) => value)
                    .map(([key, value]) => (
                      <div key={key} className="flex gap-2">
                        <dt className="text-muted flex-none">{label(key)}:</dt>
                        <dd className="min-w-0 break-words whitespace-pre-wrap">
                          {/^https:\/\//.test(value) ? (
                            <a
                              href={value}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              Open link
                            </a>
                          ) : /^\d{4}-\d{2}-\d{2}$/.test(value) ? (
                            fmtDate(value)
                          ) : (
                            value
                          )}
                        </dd>
                      </div>
                    ))}
                </dl>
                {i.canEdit ? (
                  <div className="no-print mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setOpen(i)}>
                      Update
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={d.busy}
                      onClick={() => setRemoving(i)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(o: boolean) => !o && setRemoving(null)}
          title="Remove this record?"
          description={`“${removing.title}” will be removed. This cannot be undone.`}
          confirmLabel="Remove"
          busy={d.busy}
          onConfirm={async () => {
            const id = removing.id;
            await d.send(
              "DELETE",
              `${path}/${id}`,
              undefined,
              (l) => ({ ...l, items: l.items.filter((x) => x.id !== id) }),
              "Removed",
            );
            setRemoving(null);
          }}
        />
      ) : null}
      {open && d.data ? (
        <Dialog
          open
          onOpenChange={(o: boolean) => !o && setOpen(null)}
          title={open === "new" ? `Add: ${def.title}` : `Update: ${open.title}`}
        >
          <RecordForm
            def={def}
            manage={manage}
            listing={d.data}
            item={open === "new" ? undefined : open}
            busy={d.busy}
            onSave={async (v) => {
              const editing = open === "new" ? null : open;
              const name = (list: Listing["students"], id: string) =>
                list.find((x) => x.id === id)?.name ?? "";
              const ok = editing
                ? await d.send(
                    "PATCH",
                    `${path}/${editing.id}`,
                    { title: v.title, data: v.data, ...(manage ? { status: v.status } : {}) },
                    (l) => ({
                      ...l,
                      items: l.items.map((x) =>
                        x.id === editing.id
                          ? { ...x, title: v.title, status: v.status, data: v.data }
                          : x,
                      ),
                    }),
                  )
                : await d.send(
                    "POST",
                    path,
                    {
                      title: v.title,
                      data: v.data,
                      ...(def.student && v.studentId ? { studentId: v.studentId } : {}),
                      ...(manage && def.staff && v.staffId ? { staffId: v.staffId } : {}),
                      ...(manage ? { status: v.status } : {}),
                    },
                    (l) => ({
                      ...l,
                      items: [
                        {
                          ...v,
                          id: sampleId(),
                          student: def.student ? name(l.students, v.studentId) : "",
                          staff: def.staff ? name(l.staff, v.staffId) : "",
                          by: "You",
                          createdOn: todayIso(),
                          canEdit: true,
                        },
                        ...l.items,
                      ],
                    }),
                  );
              if (ok) setOpen(null);
            }}
          />
        </Dialog>
      ) : null}
    </>
  );
}
