"use client";

import { useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import { prettyKey } from "../shared/format";
import { ApiAction, QuickAdd } from "../shared/quick-add";

/** A button that opens a list in a dialog; the list loads only when opened. */
function ListButton({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title={label}>
        {open ? <div className="grid max-h-[65vh] gap-3 overflow-y-auto">{children}</div> : null}
      </Dialog>
    </>
  );
}

function useItems<T>(path: string) {
  return useAsync(() => apiRequest<{ items: T[] }>(path), [path]);
}

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  organisation?: string | null;
  message?: string | null;
  stage: string;
}
const STAGES = ["new", "contacted", "demo", "proposal", "won", "lost"];

function Leads() {
  const { toast } = useToast();
  const d = useItems<Lead>("/platform/leads");
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  if (!d.data.items.length) return <p className="text-sm">No enquiries from the website yet.</p>;
  const move = async (id: string, stage: string) => {
    try {
      await apiRequest(`/platform/leads/${id}`, { method: "PATCH", body: { stage } });
      toast({ title: "Saved" });
      d.reload();
    } catch (e) {
      toast({
        title: "Couldn’t save",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <ul className="grid gap-3 text-sm">
      {d.data.items.map((l) => (
        <li key={l.id} className="border-line grid gap-1.5 rounded-lg border p-3">
          <p className="font-semibold">
            {l.name}
            {l.organisation ? ` · ${l.organisation}` : ""}
          </p>
          <p className="text-muted break-all">
            {l.email}
            {l.phone ? ` · ${l.phone}` : ""}
          </p>
          {l.message ? <p>{l.message}</p> : null}
          <Select
            aria-label={`Stage of ${l.name}`}
            value={l.stage}
            onChange={(e) => move(l.id, e.target.value)}
          >
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {prettyKey(s)}
              </option>
            ))}
          </Select>
        </li>
      ))}
    </ul>
  );
}

interface Request {
  id: string;
  productKey: string;
  organisation: string;
  contactEmail: string;
  status: string;
}
const NEXT: Record<string, [string, string][]> = {
  requested: [
    ["verifying", "Start checking"],
    ["rejected", "Reject"],
  ],
  verifying: [
    ["approved", "Approve"],
    ["rejected", "Reject"],
  ],
  approved: [["rejected", "Reject"]],
};

function Requests() {
  const d = useItems<Request>("/platform/provisioning-requests");
  const schools = useItems<{ id: string; name: string }>("/platform/schools");
  const [school, setSchool] = useState<Record<string, string>>({});
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={3} />;
  return (
    <>
      <div>
        <QuickAdd
          label="New request"
          title="Ask to activate a product"
          endpoint="/platform/provisioning-requests"
          onCreated={d.reload}
          fields={[
            {
              key: "productKey",
              label: "Product",
              type: "select",
              options: [{ value: "school", label: "School management" }],
            },
            { key: "organisation", label: "School or organisation" },
            { key: "contactEmail", label: "Contact email" },
            { key: "note", label: "Note", type: "textarea", required: false },
          ]}
        />
      </div>
      {d.data.items.length === 0 ? <p className="text-sm">No requests yet.</p> : null}
      <ul className="grid gap-3 text-sm">
        {d.data.items.map((r) => (
          <li key={r.id} className="border-line grid gap-2 rounded-lg border p-3">
            <p className="flex items-center justify-between gap-2">
              <span className="font-semibold">{r.organisation}</span>
              <StatusBadge status={r.status} />
            </p>
            <p className="text-muted break-all">{r.contactEmail}</p>
            {r.status === "approved" ? (
              <>
                <Select
                  aria-label={`Created school for ${r.organisation}`}
                  value={school[r.id] ?? ""}
                  onChange={(e) => setSchool((s) => ({ ...s, [r.id]: e.target.value }))}
                >
                  <option value="">Choose the school you created</option>
                  {schools.data?.items.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
                {school[r.id] ? (
                  <div>
                    <ApiAction
                      label="Mark as set up"
                      method="PATCH"
                      endpoint={`/platform/provisioning-requests/${r.id}`}
                      body={{ status: "provisioned", tenantId: school[r.id] }}
                      onDone={d.reload}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {(NEXT[r.status] ?? []).map(([status, label]) => (
                <ApiAction
                  key={status}
                  label={label}
                  method="PATCH"
                  endpoint={`/platform/provisioning-requests/${r.id}`}
                  body={{ status }}
                  onDone={d.reload}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

/** Website enquiries and activation requests, from the onboarding screen. */
export function SalesDesk() {
  return (
    <div className="flex flex-wrap gap-2">
      <ListButton label="Website enquiries">
        <Leads />
      </ListButton>
      <ListButton label="Activation requests">
        <Requests />
      </ListButton>
    </div>
  );
}

interface Mail {
  toEmail: string;
  subject: string;
  status: string;
  error: string | null;
  createdAt: string;
}
interface Product {
  key: string;
  name: string;
  summary: string;
  status: string;
}

/** The last e-mails sent, and the product list shown on the public website. */
export function MailAndProducts() {
  const mail = useItems<Mail>("/platform/mail-log");
  const products = useItems<Product>("/public/products");
  return (
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
      <Card className="grid gap-3">
        <CardHeader title="Last e-mails" hint="To find why a mail did not arrive." />
        {mail.error ? (
          <ErrorState message={mail.error.message} onRetry={mail.reload} />
        ) : !mail.data ? (
          <LoadingBlock rows={3} />
        ) : mail.data.items.length === 0 ? (
          <p className="text-sm">No e-mails yet.</p>
        ) : (
          <ul className="grid gap-2 text-sm">
            {mail.data.items.map((m, i) => (
              <li key={i} className="border-line grid gap-0.5 border-b pb-2 last:border-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{m.subject}</span>
                  <StatusBadge status={m.status} />
                </span>
                <span className="text-muted">
                  {m.toEmail} · {new Date(m.createdAt).toLocaleString("en-IN")}
                </span>
                {m.error ? <span className="text-bad break-all">{m.error}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="grid gap-3">
        <CardHeader title="Website products" hint="What visitors see on the public site." />
        {products.error ? (
          <ErrorState message={products.error.message} onRetry={products.reload} />
        ) : !products.data ? (
          <LoadingBlock rows={3} />
        ) : (
          <ul className="grid gap-2 text-sm">
            {products.data.items.map((p) => (
              <li key={p.key} className="flex items-center justify-between gap-3">
                <span>
                  <span className="font-semibold">{p.name}</span>{" "}
                  <span className="text-muted">({prettyKey(p.status)})</span>
                </span>
                <QuickAdd
                  label="Edit"
                  title={`Edit ${p.name}`}
                  method="PATCH"
                  variant="ghost"
                  endpoint={`/platform/products/${p.key}`}
                  onCreated={products.reload}
                  values={{ name: p.name, summary: p.summary, status: p.status }}
                  fields={[
                    { key: "name", label: "Name" },
                    { key: "summary", label: "Short description", type: "textarea" },
                    {
                      key: "status",
                      label: "Status",
                      type: "select",
                      options: ["available", "coming_soon", "retired"].map((v) => ({
                        value: v,
                        label: prettyKey(v),
                      })),
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
