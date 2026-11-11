export const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—";

export const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export const todayLabel = (iso: string) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

/** "feeStatus" → "Fee status" */
export const prettyKey = (k: string) =>
  k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

/** "Dr. Meera Nair" → "Meera" */
export const firstName = (full: string) =>
  full.replace(/^(Dr|Mr|Mrs|Ms|Prof)\.?\s+/i, "").split(" ")[0] ?? full;

/** "11 Nov 2026, 10:37 pm" in Indian time. */
export const fmtDateTime = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })
    : "—";
