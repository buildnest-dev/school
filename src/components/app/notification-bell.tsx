"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { env } from "@/config/env";
import { apiRequest } from "@/lib/api/client";
import type { Role } from "@/types";

interface Item {
  id: string;
  title: string;
  body: string;
  url: string | null;
  at: string;
}

const SAMPLE: Item[] = [
  {
    id: "sample-admission",
    title: "New admission: Aarav Mehta",
    body: "Sample: Aarav Mehta (ADM-2026-0042) joined Class 7 B and will use the school bus.",
    url: null,
    at: "2026-11-20T09:30:00.000Z",
  },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

/**
 * The in-app inbox, so a message is seen even on a device with phone notifications off. "New" is
 * counted from the last time this person opened the list on this device.
 */
export function NotificationBell({ userId, role }: { userId: string; role: Role }) {
  const pathname = usePathname();
  const mock = env.dataSource === "mock";
  const [items, setItems] = useState<Item[]>(mock ? SAMPLE : []);
  const [seen, setSeen] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const key = `schoolos.seen.${userId}`;
  const hidden = role === "platform_admin";

  useEffect(() => {
    if (hidden) return;
    let live = true;
    const load = () => {
      try {
        const v = localStorage.getItem(key);
        if (live && v) setSeen(v);
      } catch {
        /* storage blocked: everything counts as new */
      }
      if (!mock)
        apiRequest<{ items: Item[] }>("/me/notifications")
          .then((r) => live && setItems(r.items))
          .catch(() => {});
    };
    const first = setTimeout(load, 0);
    const again = setInterval(load, 60_000);
    return () => {
      live = false;
      clearTimeout(first);
      clearInterval(again);
    };
  }, [hidden, key, mock, pathname]);

  if (hidden) return null;
  const fresh = items.filter((i) => !seen || i.at > seen).length;

  const [shownSince, newest] = [seen, items[0]?.at];
  const close = () => {
    setOpen(false);
    if (!newest || newest === shownSince) return;
    setSeen(newest);
    try {
      localStorage.setItem(key, newest);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={fresh ? `Notifications, ${fresh} new` : "Notifications"}
        className="border-line bg-surface text-ink shadow-card relative grid size-11 flex-none place-items-center rounded-full border"
      >
        <Bell className="size-5" aria-hidden="true" />
        {fresh ? (
          <span
            aria-hidden="true"
            className="bg-bad absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full px-1 text-[0.65rem] font-bold text-white"
          >
            {fresh > 9 ? "9+" : fresh}
          </span>
        ) : null}
      </button>
      <Dialog
        open={open}
        onOpenChange={(o) => (o ? setOpen(true) : close())}
        title="Notifications"
        description="The latest messages sent to you."
      >
        {items.length === 0 ? (
          <p className="text-muted text-sm">Nothing yet.</p>
        ) : (
          <ul className="grid gap-3">
            {items.map((i) => (
              <li key={i.id} className="border-line grid gap-1 border-b pb-3 text-sm">
                <p className="flex flex-wrap items-center gap-2 font-semibold">
                  {i.title}
                  {!seen || i.at > seen ? (
                    <span className="bg-accent-light text-ink rounded-full px-2 text-xs">New</span>
                  ) : null}
                </p>
                <p>{i.body}</p>
                <p className="text-muted flex flex-wrap justify-between gap-2 text-xs">
                  <span>{when(i.at)}</span>
                  {i.url?.startsWith("/") && !i.url.startsWith("//") ? (
                    <Link href={i.url} onClick={close} className="text-accent-ink underline">
                      Open
                    </Link>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Dialog>
    </>
  );
}
