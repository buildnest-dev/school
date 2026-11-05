import { z } from "zod";
import { dob, personName, phone } from "./validators";
import type { Admission, ClassLevel } from "../generated/prisma/client";

export const STAGES = ["new", "documents", "review", "decision", "enrolled", "declined"] as const;
export type Stage = (typeof STAGES)[number];

/** Allowed moves. "enrolled" is not here: it is only reached through the admit endpoint. */
export const TRANSITIONS: Record<Stage, Stage[]> = {
  new: ["documents", "declined"],
  documents: ["review", "declined"],
  review: ["decision", "declined"],
  decision: ["declined"],
  enrolled: [],
  declined: [],
};

export const adminRow = (
  a: Admission & { applyingFor?: ClassLevel | null },
  className?: string,
) => ({
  id: a.id,
  studentName: a.studentName,
  applyingFor: className ?? "",
  guardian: a.guardianName,
  phone: a.guardianPhone,
  source: a.source,
  stage: a.stage as Stage,
  createdAt: a.createdAt.toISOString().slice(0, 10),
});

export const EnquiryBody = z.object({
  studentName: personName,
  dob: dob.optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  applyingForId: z.string().optional(),
  guardianName: personName,
  guardianPhone: phone,
  guardianEmail: z.string().trim().email().optional(),
  source: z.enum(["walk-in", "website", "referral", "phone", "other"]).default("walk-in"),
  notes: z.string().trim().max(1000).optional(),
});
