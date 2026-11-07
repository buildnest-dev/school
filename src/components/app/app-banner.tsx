"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { env } from "@/config/env";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api/client";

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS = "schoolos.banner.dismissed";
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

/** base64url public key -> the bytes the browser wants. */
function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * Makes the site behave like an app: registers the service worker, offers "Install app", and (for
 * parents) offers to turn on notifications such as "your child was absent today".
 * iPhones only allow notifications once the app is added to the Home Screen, so that comes first.
 */
export function AppBanner() {
  const { user } = useSession();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("unsupported");
  const [subscribed, setSubscribed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const isParent = user?.role === "parent";

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // Everything below reads browser-only state, so it can only run after the page has mounted.
    /* eslint-disable react-hooks/set-state-in-effect */
    setIos(isIos());
    setStandalone(isStandalone());
    try {
      setHidden(localStorage.getItem(DISMISS) === "1");
    } catch {
      setHidden(false);
    }
    if ("Notification" in window && "PushManager" in window) setPerm(Notification.permission);
    /* eslint-enable react-hooks/set-state-in-effect */
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.pushManager?.getSubscription())
      .then((sub) => setSubscribed(Boolean(sub)))
      .catch(() => {});
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setInstallEvent(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS, "1");
    } catch {
      /* ignore */
    }
  };

  const enable = useCallback(async () => {
    setNote(null);
    try {
      const { key } = await apiRequest<{ key: string | null }>("/push/public-key");
      if (!key) return setNote("Notifications are not switched on for this school yet.");
      const result = await Notification.requestPermission();
      setPerm(result);
      if (result !== "granted") return setNote("Notifications are blocked in this browser.");
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(key),
        }));
      await apiRequest("/push/subscribe", { method: "POST", body: sub.toJSON() });
      setSubscribed(true);
    } catch {
      setNote("Could not turn on notifications. Please try again.");
    }
  }, []);

  if (env.dataSource !== "api" || !user || hidden) return null;
  const needInstall = !standalone && (installEvent || ios);
  const canNotify =
    isParent && perm !== "unsupported" && perm !== "denied" && !subscribed && (standalone || !ios);
  if (!needInstall && !canNotify) return null;

  return (
    <div
      role="region"
      aria-label="Get the app"
      className="border-line bg-surface mb-5 flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
    >
      <p className="min-w-0 flex-1">
        {needInstall
          ? ios
            ? "Install this app: tap the Share button, then “Add to Home Screen”. Notifications work after that."
            : "Install this app on your phone for quick access."
          : isParent
            ? "Get a notification when your child is marked absent."
            : null}
        {note ? <span className="text-bad block">{note}</span> : null}
      </p>
      {needInstall && installEvent ? (
        <Button
          size="sm"
          onClick={async () => {
            await installEvent.prompt();
            setInstallEvent(null);
          }}
        >
          Install app
        </Button>
      ) : null}
      {!needInstall && canNotify ? (
        <Button size="sm" onClick={enable}>
          Turn on notifications
        </Button>
      ) : null}
      <button type="button" onClick={dismiss} className="text-muted underline underline-offset-4">
        Not now
      </button>
    </div>
  );
}
