import { z } from "zod";

export const ROLE_OPTIONS = [
  "Owner / committee",
  "Principal / administrator",
  "Teacher / coordinator",
  "Accounts / office staff",
  "Other",
] as const;

export const demoRequestSchema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email address."),
  school: z.string().trim().min(2, "Please enter your school or group name."),
  role: z.enum(ROLE_OPTIONS),
});
export type DemoRequest = z.infer<typeof demoRequestSchema>;
