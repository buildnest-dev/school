"use client";

import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";
import type { Student } from "@/types";
import { ApiAction, QuickAdd } from "../shared/quick-add";

interface ClassRow {
  name: string;
  sections: { id: string; name: string }[];
}

/** Owner or principal: correct a record, move class, mark as left, or give the student a login. */
export function StudentManage({ student, done }: { student: Student; done: () => void }) {
  const classes = useAsync(() => apiRequest<ClassRow[]>("/classes"), []);
  const path = `/students/${student.id}`;
  const active = student.status === "active";
  const sections = (classes.data ?? []).flatMap((c) =>
    c.sections.map((s) => ({ value: s.id, label: `${c.name} ${s.name}` })),
  );
  return (
    <div className="flex flex-wrap gap-2">
      {classes.data ? (
        <QuickAdd
          label="Edit student"
          title={student.name}
          method="PATCH"
          variant="ghost"
          endpoint={path}
          fields={[
            { key: "name", label: "Name" },
            {
              key: "sectionId",
              label: "Move to class",
              type: "select",
              options: [{ value: "", label: "No change" }, ...sections],
              required: false,
            },
            { key: "address", label: "New address", required: false },
          ]}
          values={{ name: student.name }}
          onCreated={done}
        />
      ) : null}
      <QuickAdd
        label="Edit guardian"
        title={`Guardian of ${student.name}`}
        method="PATCH"
        variant="ghost"
        endpoint={path}
        fields={[
          { key: "name", label: "Guardian's name", required: false },
          { key: "phone", label: "Phone (10 digits)", required: false },
          { key: "email", label: "E-mail", required: false },
        ]}
        values={{
          name: student.guardian ?? "",
          phone: student.phone ?? "",
          email: student.guardianEmail ?? "",
        }}
        toBody={(guardian) => ({ guardian })}
        onCreated={done}
      />
      {active ? (
        <QuickAdd
          label="Student login"
          title={`Login for ${student.name}`}
          description="An invite is e-mailed. Use an e-mail address that nobody else at the school uses."
          variant="ghost"
          endpoint={`${path}/login`}
          fields={[{ key: "email", label: "Student's e-mail" }]}
          onCreated={done}
        />
      ) : null}
      <ApiAction
        label={active ? "Mark as left school" : "Mark as studying"}
        method="PATCH"
        endpoint={path}
        body={{ status: active ? "transferred" : "active" }}
        onDone={done}
      />
    </div>
  );
}
