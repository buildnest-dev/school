import { z } from "zod";

/** Indian mobile number: optional +91, then 10 digits starting 6-9. Stored as "+91 XXXXXXXXXX". */
export const phone = z
  .string()
  .trim()
  .regex(/^(\+91[\s-]?|0)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number")
  .transform((v) => `+91 ${v.replace(/\D/g, "").slice(-10)}`);

export const dob = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((v) => !Number.isNaN(Date.parse(v)), "That date does not exist")
  .refine((v) => new Date(v).getTime() < Date.now(), "Date of birth cannot be in the future")
  .refine(
    (v) => new Date(v).getUTCFullYear() >= new Date().getUTCFullYear() - 25,
    "Date of birth looks too old for a school student",
  );

export const personName = z.string().trim().min(2, "Enter the full name").max(80);

export const last4 = z
  .string()
  .regex(/^\d{4}$/, "Enter only the last 4 digits of the Aadhaar number");

export const guardianInput = z.object({
  name: personName,
  relation: z.enum(["father", "mother", "guardian"]),
  phone,
  email: z.string().trim().email().optional(),
});

export const CATEGORIES = ["General", "OBC", "SC", "ST", "EWS"] as const;
export const GENDERS = ["male", "female", "other"] as const;
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

export const studentFields = z.object({
  name: personName,
  dob,
  gender: z.enum(GENDERS),
  sectionId: z.string().min(1),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  category: z.enum(CATEGORIES).optional(),
  motherTongue: z.string().trim().max(40).optional(),
  religion: z.string().trim().max(40).optional(),
  aadhaarLast4: last4.optional(),
  penNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{6,20}$/, "PEN must be 6-20 letters/digits")
    .optional(),
  apaarId: z
    .string()
    .trim()
    .regex(/^\d{12}$/, "APAAR ID is 12 digits")
    .optional(),
  stateId: z.string().optional(),
  districtId: z.string().optional(),
  address: z.string().trim().max(300).optional(),
});
