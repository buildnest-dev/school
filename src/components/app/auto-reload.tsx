"use client";

import { useEffect } from "react";

const KEY = "schoolos.autoreload";

/**
 * A tab left open across a new release asks for pages and scripts that no longer exist, which
 * shows up as "page not found" or a load error. Reloading once fetches the current release. It
 * reloads at most once a minute, so a page that is really missing cannot loop. Returns true when
 * it has started a reload.
 */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Renders nothing; refreshes the page once when shown. */
export function AutoReload() {
  useEffect(() => {
    reloadOnce();
  }, []);
  return null;
}
