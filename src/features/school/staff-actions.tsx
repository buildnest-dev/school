"use client";

import { ApiAction, QuickAdd } from "../shared/quick-add";

/** Correct a staff record, or switch the person off (which also frees their periods). */
export function StaffManage({ row, done }: { row: Record<string, unknown>; done: () => void }) {
  const path = `/staff/${String(row.id)}`;
  const active = row.status !== "inactive";
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <QuickAdd
        label="Edit details"
        title={String(row.name)}
        method="PATCH"
        variant="ghost"
        endpoint={path}
        fields={[
          { key: "name", label: "Full name" },
          { key: "phone", label: "New phone (10 digits)", required: false },
          { key: "email", label: "New e-mail", required: false },
          { key: "department", label: "New department", required: false },
        ]}
        values={{ name: String(row.name) }}
        onCreated={done}
      />
      <ApiAction
        label={active ? "Mark inactive" : "Mark active"}
        method="PATCH"
        endpoint={path}
        body={{ status: active ? "inactive" : "active" }}
        onDone={done}
      />
    </div>
  );
}
