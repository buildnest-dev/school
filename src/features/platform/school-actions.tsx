"use client";

import { Check, Circle } from "lucide-react";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api/client";
import { ApiAction, QuickAdd } from "../shared/quick-add";

type Detail = {
  status: string;
  checklist: { key: string; label: string; ok: boolean; detail: string }[];
};

/**
 * Under a school's details on the team site: what is still open before it can go live, and the
 * buttons to take it live, suspend it or bring it back.
 */
export function SchoolActions({ id, onDone }: { id: string; onDone: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    apiRequest<Detail>(`/platform/schools/${id}`)
      .then((r) => live && setD(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [id]);

  if (failed)
    return <p className="text-muted mt-4 text-sm">Could not load the go-live checklist.</p>;
  if (!d) return <p className="text-muted mt-4 text-sm">Loading the checklist…</p>;
  const endpoint = `/platform/schools/${id}`;
  const open = d.checklist.filter((c) => !c.ok).length;
  return (
    <div className="mt-5 grid gap-3">
      {d.status === "provisioned" ? (
        <>
          <h3 className="text-sm font-semibold">
            Before going live {open ? `(${open} open)` : "(all done)"}
          </h3>
          <ul className="grid gap-1.5 text-sm">
            {d.checklist.map((c) => (
              <li key={c.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  {c.ok ? (
                    <Check className="text-ok size-4" aria-hidden="true" />
                  ) : (
                    <Circle className="text-muted size-4" aria-hidden="true" />
                  )}
                  {c.label}
                </span>
                <span className="text-muted">{c.detail}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {d.status === "provisioned" ? (
          <ApiAction
            label="Go live"
            method="POST"
            endpoint={`${endpoint}/go-live`}
            body={{}}
            variant="primary"
            onDone={onDone}
          />
        ) : null}
        {d.status === "suspended" ? (
          <ApiAction
            label="Reactivate"
            method="PATCH"
            endpoint={endpoint}
            body={{ suspended: false }}
            variant="primary"
            onDone={onDone}
          />
        ) : (
          <ApiAction
            label="Suspend"
            method="PATCH"
            endpoint={endpoint}
            body={{ suspended: true }}
            onDone={onDone}
          />
        )}
        <QuickAdd
          label="Invite another owner"
          title="Invite an owner"
          description="They get an e-mail with a link to set a password."
          variant="ghost"
          endpoint={`${endpoint}/owner`}
          onCreated={onDone}
          fields={[
            { key: "ownerName", label: "Name" },
            { key: "ownerEmail", label: "Email" },
          ]}
        />
        <QuickAdd
          label="Bank account"
          title="School’s bank account"
          description="The account number is stored encrypted and is not shown again."
          variant="ghost"
          method="PUT"
          endpoint={`${endpoint}/bank`}
          onCreated={onDone}
          fields={[
            { key: "holderName", label: "Account holder" },
            { key: "bankName", label: "Bank" },
            { key: "ifsc", label: "IFSC code" },
            { key: "accountNumber", label: "Account number" },
          ]}
        />
        <ApiAction
          label="Add web addresses again"
          method="POST"
          endpoint={`${endpoint}/domains`}
          body={{}}
          success="Web addresses requested"
          onDone={onDone}
        />
      </div>
    </div>
  );
}
