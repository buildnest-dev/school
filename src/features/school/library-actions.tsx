"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { apiRequest } from "@/lib/api/client";
import type { Role } from "@/types";
import { ApiAction, QuickAdd, type QuickField } from "../shared/quick-add";
import { PersonSearch } from "./borrower-search";

export const LIBRARY_ROLES: readonly Role[] = ["school_owner", "principal", "librarian"];

const CATEGORIES = [
  "Textbook",
  "Fiction",
  "Non-fiction",
  "Reference",
  "Biography",
  "History",
  "Science",
  "Children",
  "Magazine",
  "Other",
].map((v) => ({ value: v, label: v }));

const FIELDS: QuickField[] = [
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "category", label: "Category", type: "select", options: CATEGORIES },
  { key: "totalCopies", label: "Number of copies", type: "number" },
  { key: "isbn", label: "ISBN", required: false },
  { key: "shelf", label: "Shelf", required: false },
];

export function AddBook({ onCreated }: { onCreated: () => void }) {
  return (
    <QuickAdd
      label="Add book"
      title="Add a book"
      endpoint="/library/books"
      fields={FIELDS}
      values={{ totalCopies: "1" }}
      onCreated={onCreated}
    />
  );
}

function IssueBook({ bookId, title, done }: { bookId: string; title: string; done: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"students" | "staff">("students");
  const [person, setPerson] = useState("");
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const issue = async () => {
    setBusy(true);
    try {
      await apiRequest("/library/loans", {
        method: "POST",
        body: {
          bookId,
          [kind === "students" ? "studentId" : "staffId"]: person,
          dueDays: Number(days),
        },
      });
      toast({ title: "Book issued", description: title });
      setOpen(false);
      done();
    } catch (e) {
      toast({
        title: "Couldn’t issue the book",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button onClick={() => setOpen(true)}>Issue this book</Button>
      <Dialog open={open} onOpenChange={(o) => !busy && setOpen(o)} title={`Issue ${title}`}>
        <div className="grid gap-3">
          <label className="grid gap-1.5 text-sm font-semibold">
            Lend to
            <Select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value as "students" | "staff");
                setPerson("");
              }}
            >
              <option value="students">A student</option>
              <option value="staff">A staff member</option>
            </Select>
          </label>
          <PersonSearch kind={kind} value={person} onChange={setPerson} />
          <label className="grid gap-1.5 text-sm font-semibold">
            Days to return
            <Input
              type="number"
              min={1}
              max={60}
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </label>
          <div>
            <Button onClick={issue} disabled={busy || !person}>
              {busy ? "Saving…" : "Issue"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}

export function BookActions({ row, done }: { row: Record<string, unknown>; done: () => void }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {Number(row.available) > 0 ? (
        <IssueBook bookId={String(row.id)} title={String(row.title)} done={done} />
      ) : null}
      <QuickAdd
        label="Change copies"
        title={`Copies of ${String(row.title)}`}
        method="PATCH"
        variant="ghost"
        endpoint={`/library/books/${String(row.id)}`}
        fields={[{ key: "totalCopies", label: "Total copies", type: "number" }]}
        values={{ totalCopies: String(row.copies) }}
        onCreated={done}
      />
    </div>
  );
}

export function LoanActions({
  row,
  done,
  role,
}: {
  row: Record<string, unknown>;
  done: () => void;
  role: Role;
}) {
  const path = `/library/loans/${String(row.id)}`;
  if (row.status !== "returned")
    return (
      <div className="mt-4">
        <ApiAction
          label="Take the book back"
          variant="primary"
          method="POST"
          endpoint={`${path}/return`}
          body={{}}
          success="Book returned."
          onDone={done}
        />
      </div>
    );
  if (row.fineStatus !== "due") return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <ApiAction
        label="Fine collected"
        method="PATCH"
        endpoint={`${path}/fine`}
        body={{ status: "paid" }}
        success="Fine marked as paid."
        onDone={done}
      />
      {role !== "librarian" ? (
        <ApiAction
          label="Waive fine"
          method="PATCH"
          endpoint={`${path}/fine`}
          body={{ status: "waived" }}
          success="Fine waived."
          onDone={done}
        />
      ) : null}
    </div>
  );
}
