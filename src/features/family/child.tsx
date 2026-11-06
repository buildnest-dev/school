"use client";

import { useSyncExternalStore } from "react";
import { PageHeader } from "@/components/shared/blocks";
import { Select } from "@/components/ui/field";
import { LoadingBlock, ErrorState } from "@/components/ui/states";
import { useAsync } from "@/hooks/use-async";
import { useServices } from "@/hooks/use-services";
import { useSession } from "@/hooks/use-session";
import type { Child } from "@/types";

/** Tiny store for "which child is selected" (a UI preference, not data). */
let selected: string | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const setSelected = (id: string) => {
  selected = id;
  listeners.forEach((l) => l());
};

/**
 * The child whose information is shown. Parents may only see children listed on their session
 * (`childIds`); students see themselves. The backend must enforce the same rule.
 */
export function useActiveChild() {
  const s = useServices();
  const { user } = useSession();
  const pick = useSyncExternalStore(
    subscribe,
    () => selected,
    () => null,
  );
  const list = useAsync(() => s.family.children(), [s]);
  const allowed: Child[] =
    s.mode === "api"
      ? (list.data ?? [])
      : (list.data ?? []).filter((c) =>
          user?.role === "student" ? c.id === "c-aarav" : (user?.childIds ?? []).includes(c.id),
        );
  const child = allowed.find((c) => c.id === pick) ?? allowed[0];
  return {
    child,
    children: allowed,
    loading: list.loading,
    error: list.error,
    reload: list.reload,
    select: setSelected,
    isParent: user?.role === "parent",
  };
}

/** Page header with the child selector for parents with more than one child. */
export function ChildPage({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: (childId: string) => React.ReactNode;
}) {
  const a = useActiveChild();
  if (a.error) return <ErrorState message={a.error.message} onRetry={a.reload} />;
  if (a.loading || !a.child) return <LoadingBlock />;
  const picker =
    a.isParent && a.children.length > 1 ? (
      <div>
        <label htmlFor="child-select" className="text-muted mb-1 block text-xs font-semibold">
          Showing
        </label>
        <Select
          id="child-select"
          value={a.child.id}
          onChange={(e) => a.select(e.target.value)}
          className="min-w-48"
        >
          {a.children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · Class {c.classSection}
            </option>
          ))}
        </Select>
      </div>
    ) : null;
  return (
    <>
      <PageHeader
        title={title}
        description={
          a.isParent
            ? `${description ?? ""} ${a.child.name}, Class ${a.child.classSection}.`.trim()
            : description
        }
        actions={picker}
      />
      {children(a.child.id)}
    </>
  );
}
