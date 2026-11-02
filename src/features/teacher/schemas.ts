import { z } from "zod";

export const LEAVE_TYPES = ["Casual leave", "Medical leave", "Duty leave", "Other"] as const;

export const homeworkSchema = (today: string) =>
  z.object({
    classId: z.string().min(1, "Choose a class."),
    title: z.string().trim().min(3, "Give the homework a short title (at least 3 letters)."),
    instructions: z.string().trim().min(5, "Tell students what to do (at least a few words)."),
    due: z
      .string()
      .min(1, "Choose a due date.")
      .refine((d) => d >= today, "The due date can’t be in the past."),
  });
export type HomeworkForm = z.infer<ReturnType<typeof homeworkSchema>>;

export const leaveSchema = (today: string) =>
  z
    .object({
      from: z
        .string()
        .min(1, "Choose the first day of leave.")
        .refine((d) => d >= today, "The first day can’t be in the past."),
      to: z.string().min(1, "Choose the last day of leave."),
      type: z.enum(LEAVE_TYPES),
      reason: z.string().trim().min(3, "Add a short reason."),
    })
    .refine((v) => !v.from || !v.to || v.to >= v.from, {
      path: ["to"],
      message: "The last day must be on or after the first day.",
    });
export type LeaveForm = z.infer<ReturnType<typeof leaveSchema>>;

/** Marks: empty means "not entered yet". Returns an error message or null. */
export function validateMark(raw: string, max: number): string | null {
  if (raw.trim() === "") return null;
  if (!/^\d+(\.\d)?$/.test(raw.trim())) return "Enter a number, like 38 or 38.5.";
  const n = Number(raw);
  if (n < 0) return "Marks can’t be negative.";
  if (n > max) return `Marks can’t be more than ${max}.`;
  return null;
}
