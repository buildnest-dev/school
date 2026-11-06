import { z } from "zod";
import { HttpError } from "./auth";

export const TICKET_CATEGORIES = ["question", "problem", "billing", "request"] as const;
export const TICKET_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const TICKET_STATUSES = ["open", "pending", "resolved", "closed"] as const;

export const NewTicket = z.object({
  subject: z.string().trim().min(5, "Describe the problem in a few words").max(150),
  body: z.string().trim().min(10, "Tell us a little more").max(5000),
  category: z.enum(TICKET_CATEGORIES).default("question"),
  priority: z.enum(TICKET_PRIORITIES).default("normal"),
});
export const Reply = z.object({ body: z.string().trim().min(1).max(5000) });

/** Parents and students use their own portal, not the school's support desk. */
export function assertStaff(role: string) {
  if (role === "parent" || role === "student")
    throw new HttpError(403, "forbidden", "Support is for school staff.");
}
/** Owner and principal see every ticket of the school; other staff see only their own. */
export const seesAllTickets = (role: string) => role === "school_owner" || role === "principal";

export const ticketRow = (t: {
  id: string;
  number: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: t.id,
  number: t.number,
  subject: t.subject,
  category: t.category,
  priority: t.priority,
  status: t.status,
  createdAt: t.createdAt.toISOString(),
  updatedAt: t.updatedAt.toISOString(),
});
