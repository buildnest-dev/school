"use client";

import { useEffect } from "react";
import { reloadOnce } from "@/components/app/auto-reload";

/** A screen that failed to load or draw. After a release the cause is usually a stale tab. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    reloadOnce();
  }, []);
  return (
    <main id="main" className="grid min-h-screen place-items-center p-6">
      <div className="grid max-w-md gap-3 text-center">
        <h1 className="text-2xl">This page could not load</h1>
        <p className="text-muted">
          It may be out of date. Refresh to get the latest version.
        </p>
        <div className="flex justify-center gap-2">
          <button
            type="button"
            className="rounded-md border px-4 py-2"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
          <button type="button" className="rounded-md border px-4 py-2" onClick={() => reset()}>
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
