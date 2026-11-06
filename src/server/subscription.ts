/**
 * What a school may do, from its stored plan and dates.
 * - trial / active: normal use.
 * - past_due: the period has ended; a reminder phase of `graceDays`, everything still works.
 * - restricted: grace is over; staff can read and export but not change anything.
 * - cancelled: same as restricted; the school can still export its records.
 * Parents and students always keep read access to their own records.
 */
export type SubscriptionState = "trial" | "active" | "past_due" | "restricted" | "cancelled";

const DAY = 86_400_000;

export function effectiveSubscription(
  t: { subscription: string; periodEnd: Date | null; graceDays: number },
  now = new Date(),
): SubscriptionState {
  if (t.subscription === "cancelled") return "cancelled";
  const stored = t.subscription === "active" ? "active" : "trial";
  if (!t.periodEnd || now <= t.periodEnd) return stored;
  const overdueDays = Math.floor((now.getTime() - t.periodEnd.getTime()) / DAY);
  return overdueDays <= t.graceDays ? "past_due" : "restricted";
}

export const isReadOnly = (s: SubscriptionState) => s === "restricted" || s === "cancelled";
