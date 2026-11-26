import { z } from "zod";

/** Pay is private: only the owner and the accountant handle it. */
export const PAY_ROLES = ["school_owner", "accountant"] as const;

export const Lines = z
  .array(
    z.object({
      label: z.string().trim().min(1).max(60),
      rupees: z.number().int().min(0).max(10_000_000),
    }),
  )
  .max(15);
export type PayLine = z.infer<typeof Lines>[number];

export const linesOf = (json: string) => JSON.parse(json) as PayLine[];
const sum = (l: PayLine[]) => l.reduce((s, x) => s + x.rupees, 0);
/** Take-home pay in rupees. No statutory amount is worked out: the school enters each line. */
export const netOf = (earnings: PayLine[], deductions: PayLine[]) =>
  sum(earnings) - sum(deductions);
