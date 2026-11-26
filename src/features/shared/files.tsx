"use client";

import { Download, Paperclip } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { ErrorState, LoadingBlock } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { env, todayIso } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { fmtDate } from "./format";
import { sampleId, useData } from "./use-data";

interface FileRow {
  id: string;
  name: string;
  size: number;
  mime: string;
  addedOn: string;
  canRemove: boolean;
}

const MAX = 1024 * 1024;

const asBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("The file could not be read."));
    r.readAsDataURL(file);
  });

/** The files kept against one student or one study material, with upload when allowed. */
export function Files({
  entity,
  entityId,
  canAdd = false,
}: {
  entity: "student" | "material";
  entityId: string;
  canAdd?: boolean;
}) {
  const { toast } = useToast();
  const d = useData<FileRow[]>(`/attachments?entity=${entity}&entityId=${entityId}`, []);
  const add = async (input: HTMLInputElement) => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (file.size > MAX) {
      toast({ title: "The file is larger than 1 MB", tone: "error" });
      return;
    }
    await d.send(
      "POST",
      "/attachments",
      { entity, entityId, name: file.name, data: await asBase64(file) },
      (list) => [
        {
          id: sampleId(),
          name: file.name,
          size: file.size,
          mime: file.type,
          addedOn: todayIso(),
          canRemove: true,
        },
        ...list,
      ],
      "File saved",
    );
  };
  if (d.error) return <ErrorState message={d.error.message} onRetry={d.reload} />;
  if (!d.data) return <LoadingBlock rows={1} />;
  return (
    <div className="grid gap-2">
      {d.data.length ? (
        <ul className="grid gap-2">
          {d.data.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Paperclip className="text-muted size-4" aria-hidden="true" />
              <span className="text-ink font-medium break-all">{f.name}</span>
              <span className="text-muted">
                {Math.max(1, Math.round(f.size / 1024))} KB · {fmtDate(f.addedOn)}
              </span>
              {env.dataSource === "api" ? (
                <Button asChild variant="ghost" size="sm">
                  <a href={`${env.apiBaseUrl.replace(/\/$/, "")}/attachments/${f.id}`}>
                    Download <Download className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
              {f.canRemove ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={d.busy}
                  onClick={() =>
                    d.send(
                      "DELETE",
                      `/attachments/${f.id}`,
                      undefined,
                      (l) => l.filter((x) => x.id !== f.id),
                      "File removed",
                    )
                  }
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : canAdd ? null : (
        <p className="text-muted text-sm">No files.</p>
      )}
      {canAdd ? (
        <label className="text-muted block text-sm">
          <span className="mb-1 block">Add a PDF or photo (up to 1 MB)</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            disabled={d.busy}
            onChange={(e) => void add(e.target)}
            className="block w-full text-sm"
          />
        </label>
      ) : null}
    </div>
  );
}

/** Office view: pick a student, keep their documents. */
export function StudentFiles() {
  const s = useServices();
  const students = useAsync(
    () => s.resource("students").list({ pageSize: 200, sort: "name", order: "asc" }),
    [s],
  );
  const [id, setId] = useState("");
  return (
    <>
      <PageHeader
        title="Student documents"
        description="Birth certificate, previous school papers, photo and other files."
      />
      <div className="mb-5 max-w-sm">
        <label htmlFor="file-student" className="mb-1.5 block text-sm font-semibold">
          Student
        </label>
        <Select id="file-student" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">Choose a student</option>
          {students.data?.items.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · {x.classSection} · {x.admissionNo}
            </option>
          ))}
        </Select>
      </div>
      {id ? (
        <Card className="max-w-2xl">
          <Files key={id} entity="student" entityId={id} canAdd />
        </Card>
      ) : null}
    </>
  );
}
