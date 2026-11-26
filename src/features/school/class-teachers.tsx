"use client";

import { Select } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

interface Teacher {
  id: string;
  name: string;
}
interface Section {
  id: string;
  name: string;
  classTeacherId: string | null;
}

/** One teacher per section; they get the new admission alerts for it. */
export function ClassTeachers({
  className,
  sections,
  onSaved,
}: {
  className: string;
  sections: Section[];
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const teachers = useAsync(
    () =>
      apiRequest<{ items: Teacher[] }>("/staff", {
        query: { role: "teacher", status: "active" },
      }).then((r) => r.items),
    [],
  );
  const save = async (sectionId: string, staffId: string) => {
    try {
      await apiRequest(`/sections/${sectionId}/class-teacher`, {
        method: "PUT",
        body: { staffId: staffId || null },
      });
      toast({ title: "Class teacher saved" });
      onSaved();
    } catch (e) {
      toast({
        title: "Couldn’t save",
        description: e instanceof Error ? e.message : "Please try again.",
        tone: "error",
      });
    }
  };
  return (
    <div className="flex flex-wrap gap-3">
      {sections.map((s) => (
        <label key={s.id} className="grid gap-1 text-sm font-semibold">
          Class teacher, {className} {s.name}
          <Select
            value={s.classTeacherId ?? ""}
            disabled={!teachers.data}
            onChange={(e) => save(s.id, e.target.value)}
          >
            <option value="">Not chosen</option>
            {teachers.data?.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </label>
      ))}
    </div>
  );
}
