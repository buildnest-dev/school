"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { linkOn } from "@/config/features";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api/client";
import type { Role } from "@/types";
import { ApiAction } from "../shared/quick-add";

const CAN_ADMIT: Role[] = ["school_owner", "principal", "vice_principal", "admission_officer"];
const NEXT: Record<string, string> = { new: "documents", documents: "review", review: "decision" };
const STEP_LABEL: Record<string, string> = {
  documents: "Move to documents",
  review: "Move to review",
  decision: "Move to decision",
};

interface ClassRow {
  id: string;
  name: string;
  sections: { id: string; name: string }[];
}

/** The buttons under one admission enquiry: the next stage, decline, and finally "Admit". */
export function EnquiryActions({
  row,
  done,
  role,
}: {
  row: Record<string, unknown>;
  done: () => void;
  role: Role;
}) {
  const stage = String(row.stage);
  const id = String(row.id);
  if (!CAN_ADMIT.includes(role) || stage === "enrolled" || stage === "declined") return null;
  const next = NEXT[stage];
  return (
    <div className="mt-4 grid gap-4">
      {stage === "decision" ? <AdmitForm id={id} done={done} /> : null}
      <div className="flex flex-wrap gap-2">
        {next ? (
          <ApiAction
            label={STEP_LABEL[next]!}
            method="PATCH"
            variant="primary"
            endpoint={`/admissions/enquiries/${id}`}
            body={{ stage: next }}
            onDone={done}
          />
        ) : null}
        <ApiAction
          label="Decline"
          method="PATCH"
          endpoint={`/admissions/enquiries/${id}`}
          body={{ stage: "declined" }}
          onDone={done}
        />
      </div>
    </div>
  );
}

function AdmitForm({ id, done }: { id: string; done: () => void }) {
  const { toast } = useToast();
  const { user } = useSession();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  const [sectionId, setSection] = useState("");
  const [needsBus, setBus] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiRequest<ClassRow[]>("/classes")
      .then(setClasses)
      .catch(() => setClasses([]));
  }, []);

  const admit = async () => {
    setBusy(true);
    try {
      const r = await apiRequest<{ admissionNo: string; message: string }>(
        `/admissions/enquiries/${id}/admit`,
        { method: "POST", body: { sectionId, needsBus } },
      );
      toast({ title: `Admitted: ${r.admissionNo}`, description: r.message });
      done();
    } catch (err) {
      toast({
        title: "Couldn’t admit",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-line bg-paper grid gap-3 rounded-lg border p-3">
      <Field id="admit-section" label="Class and section" required>
        {(a) => (
          <Select {...a} value={sectionId} onChange={(e) => setSection(e.target.value)}>
            <option value="">{classes === null ? "Loading…" : "Choose"}</option>
            {(classes ?? []).flatMap((c) =>
              c.sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {c.name} · {s.name}
                </option>
              )),
            )}
          </Select>
        )}
      </Field>
      {linkOn("/school/transport", user?.disabledFeatures) ? (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={needsBus} onChange={(e) => setBus(e.target.checked)} />
          Will use the school bus
        </label>
      ) : null}
      <div>
        <Button onClick={admit} disabled={busy || !sectionId}>
          {busy ? "Admitting…" : "Admit student"}
        </Button>
      </div>
    </div>
  );
}
