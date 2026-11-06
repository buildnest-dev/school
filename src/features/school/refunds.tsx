"use client";

import { useState } from "react";
import { DevNote, PageHeader } from "@/components/shared/blocks";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api/client";
import { fmtDate, rupees } from "../shared/format";

interface RefundRow {
  id: string;
  status: string;
  amount: number;
  reason: string;
  requestedAt: string;
  invoiceNumber: string | null;
  studentName: string | null;
}

/** Refund requests. Approving one posts a negative payment; the school then pays the money back. */
export function Refunds() {
  const { toast } = useToast();
  const { user } = useSession();
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const canDecide = user?.role === "school_owner" || user?.role === "principal";

  const decide = async (id: string, approve: boolean) => {
    setBusy(id);
    try {
      await apiRequest(`/fees/refunds/${id}/decision`, { method: "POST", body: { approve } });
      toast({ title: approve ? "Refund approved" : "Refund rejected" });
      setReloadKey((k) => k + 1);
    } catch (e) {
      toast({
        title: "Couldn’t save the decision",
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
        title="Refunds"
        description="Refund requests from accounts. A different person from the one who asked must decide."
      />
      {env.dataSource !== "api" ? (
        <DevNote>Refunds are available once the school is connected to the live backend.</DevNote>
      ) : (
        <DataTable<RefundRow>
          caption="Refunds"
          reloadKey={reloadKey}
          searchPlaceholder="Search refunds"
          columns={[
            { key: "studentName", header: "Student", sortable: true },
            { key: "invoiceNumber", header: "Invoice", hideOnMobile: true },
            { key: "amount", header: "Amount", sortable: true, render: (r) => rupees(r.amount) },
            { key: "reason", header: "Reason", hideOnMobile: true },
            { key: "requestedAt", header: "Asked", render: (r) => fmtDate(r.requestedAt) },
            { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
            {
              key: "id",
              header: "",
              render: (r) =>
                canDecide && r.status === "requested" ? (
                  <span className="flex gap-2">
                    <Button size="sm" disabled={busy === r.id} onClick={() => decide(r.id, true)}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === r.id}
                      onClick={() => decide(r.id, false)}
                    >
                      Reject
                    </Button>
                  </span>
                ) : null,
            },
          ]}
          load={async (p) => {
            const res = await apiRequest<{ items: RefundRow[] }>("/fees/refunds");
            const q = (p.q ?? "").toLowerCase();
            const items = res.items.filter(
              (r) =>
                !q ||
                (r.studentName ?? "").toLowerCase().includes(q) ||
                (r.invoiceNumber ?? "").toLowerCase().includes(q),
            );
            return { items, total: items.length, page: 1, pageSize: items.length || 1 };
          }}
        />
      )}
    </>
  );
}
