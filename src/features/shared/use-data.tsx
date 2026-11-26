"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { env } from "@/config/env";
import { useAsync } from "@/hooks/use-async";
import { apiRequest } from "@/lib/api/client";

/** Sample records for the mock build, kept while the tab is open. */
const sampleStore = new Map<string, unknown>();

/**
 * One list or record for a screen: from the server in the live app, from memory in the sample
 * build. `send` makes a change and reloads; `apply` says what the change does to the sample data.
 */
export function useData<T>(path: string, sample: T) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const mock = env.dataSource === "mock";
  const state = useAsync<T>(
    () =>
      mock
        ? Promise.resolve((sampleStore.get(path) as T | undefined) ?? sample)
        : apiRequest<T>(path),
    [path],
  );

  const send = async (
    method: "POST" | "PUT" | "PATCH" | "DELETE",
    endpoint: string,
    body: unknown,
    apply: (current: T) => T,
    done = "Saved",
  ) => {
    setBusy(true);
    try {
      if (mock) sampleStore.set(path, apply((sampleStore.get(path) as T | undefined) ?? sample));
      else {
        const r = await apiRequest<{ message?: string }>(endpoint, { method, body });
        done = r?.message ?? done;
      }
      toast({ title: done });
      state.reload();
      return true;
    } catch (err) {
      toast({
        title: "Couldn’t save",
        description: err instanceof Error ? err.message : "Please try again.",
        tone: "error",
      });
      return false;
    } finally {
      setBusy(false);
    }
  };

  return { ...state, send, busy };
}

let n = 0;
export const sampleId = () => `sample-${++n}`;
