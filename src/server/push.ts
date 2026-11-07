import webpush from "web-push";
import { prisma } from "./db";

/**
 * Notifications to phones. Needs a VAPID key pair (free, made once with `npx web-push
 * generate-vapid-keys`): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT (a mailto: address).
 * Without them nothing is pushed, but each notification is still stored so it can be read in the app.
 */
const configured = () =>
  Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT,
  );

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;

export interface Notice {
  title: string;
  body: string;
  /** Where tapping the notification goes (a path on the same address). */
  url?: string;
}

/** Sends one notification to each person's devices and records it. Never throws: a failed push must not fail the work that caused it. */
export async function notifyUsers(tenantId: string, userIds: string[], n: Notice) {
  const ids = [...new Set(userIds)];
  if (!ids.length) return;
  try {
    const subs = await prisma.pushSubscription.findMany({
      where: { tenantId, userId: { in: ids } },
    });
    const byUser = new Map<string, typeof subs>();
    for (const s of subs) byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);

    if (configured())
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT!,
        process.env.VAPID_PUBLIC_KEY!,
        process.env.VAPID_PRIVATE_KEY!,
      );
    const payload = JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/" });
    const gone: string[] = [];

    const delivery = new Map<string, string>();
    await Promise.all(
      ids.map(async (uid) => {
        const mine = byUser.get(uid) ?? [];
        if (!configured()) return void delivery.set(uid, "not_configured");
        if (!mine.length) return void delivery.set(uid, "no_device");
        const results = await Promise.allSettled(
          mine.map((s) =>
            webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
              { TTL: 24 * 3600, urgency: "high" },
            ),
          ),
        );
        results.forEach((r, i) => {
          if (r.status === "rejected") {
            const code = (r.reason as { statusCode?: number })?.statusCode;
            if (code === 404 || code === 410) gone.push(mine[i]!.id);
          }
        });
        delivery.set(uid, results.some((r) => r.status === "fulfilled") ? "sent" : "failed");
      }),
    );
    if (gone.length) await prisma.pushSubscription.deleteMany({ where: { id: { in: gone } } });
    await prisma.appNotification.createMany({
      data: ids.map((userId) => ({
        tenantId,
        userId,
        title: n.title,
        body: n.body,
        url: n.url ?? null,
        delivery: delivery.get(userId) ?? "failed",
      })),
    });
  } catch (e) {
    console.error("notifyUsers failed", e);
  }
}
