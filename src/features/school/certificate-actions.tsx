"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { env, todayIso } from "@/config/env";
import { apiRequest } from "@/lib/api/client";

type Row = Record<string, unknown>;
const CONDUCT = ["excellent", "good", "satisfactory"];

/**
 * Issue / reject a waiting certificate request, or cancel an issued one. Only shown against the
 * real backend, which does the checks (dues, library items, who may decide) and writes the audit
 * trail; this just collects what it needs.
 */
export function CertificateActions({ row, onDone }: { row: Row; onDone: () => void }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"issue" | "reject" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [conduct, setConduct] = useState("good");
  const [leavingDate, setLeavingDate] = useState(todayIso());
  const [leavingReason, setLeavingReason] = useState("");
  const [promotedTo, setPromotedTo] = useState("");

  if (env.dataSource !== "api") return null;
  const id = String(row.id);
  const type = String(row.type).toLowerCase();
  const pending = row.status === "pending";
  const issued = row.status === "issued";
  if (!pending && !issued) return null;

  const call = async (action: "issue" | "reject" | "cancel", body: unknown) => {
    setBusy(true);
    try {
      await apiRequest(`/certificates/${id}/${action}`, { method: "POST", body: body ?? {} });
      toast({ title: action === "issue" ? "Certificate issued" : `Request ${action}ed` });
      onDone();
    } catch (e) {
      toast({
        title: "Couldn’t complete that",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const issueBody = () =>
    type === "bonafide"
      ? {}
      : type === "character"
        ? { conduct }
        : {
            leavingDate,
            reasonForLeaving: leavingReason,
            conduct,
            ...(promotedTo ? { promotedTo } : {}),
          };

  return (
    <div className="mt-4 grid gap-3">
      {mode === null ? (
        <div className="flex flex-wrap gap-2">
          {pending ? (
            <>
              <Button
                size="sm"
                disabled={busy}
                onClick={() => (type === "bonafide" ? call("issue", {}) : setMode("issue"))}
              >
                Issue certificate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMode("reject")}>
                Reject request
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setMode("cancel")}>
              Cancel certificate
            </Button>
          )}
        </div>
      ) : null}

      {mode === "issue" ? (
        <>
          <Field id="cert-conduct" label="Conduct" required>
            {(a) => (
              <Select {...a} value={conduct} onChange={(e) => setConduct(e.target.value)}>
                {CONDUCT.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {type === "transfer" ? (
            <>
              <Field id="cert-leaving" label="Leaving date" required>
                {(a) => (
                  <Input
                    {...a}
                    type="date"
                    value={leavingDate}
                    onChange={(e) => setLeavingDate(e.target.value)}
                  />
                )}
              </Field>
              <Field id="cert-why" label="Reason for leaving" required>
                {(a) => (
                  <Input
                    {...a}
                    value={leavingReason}
                    onChange={(e) => setLeavingReason(e.target.value)}
                  />
                )}
              </Field>
              <Field id="cert-promoted" label="Promoted to (optional)">
                {(a) => (
                  <Input
                    {...a}
                    value={promotedTo}
                    onChange={(e) => setPromotedTo(e.target.value)}
                  />
                )}
              </Field>
            </>
          ) : null}
          <div className="flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => call("issue", issueBody())}>
              {busy ? "Issuing…" : "Confirm and issue"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Back
            </Button>
          </div>
        </>
      ) : null}

      {mode === "reject" || mode === "cancel" ? (
        <>
          <Field
            id="cert-reason"
            label={
              mode === "reject" ? "Reason (the parent can read this)" : "Reason for cancelling"
            }
            required
          >
            {(a) => <Input {...a} value={reason} onChange={(e) => setReason(e.target.value)} />}
          </Field>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={busy || reason.trim().length < 3}
              onClick={() => call(mode, { reason: reason.trim() })}
            >
              {busy ? "Saving…" : mode === "reject" ? "Reject request" : "Cancel certificate"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Back
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
