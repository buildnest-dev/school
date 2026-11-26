import { z } from "zod";

export const Question = z
  .object({
    text: z.string().trim().min(2).max(500),
    options: z.array(z.string().trim().min(1).max(200)).min(2).max(6),
    answer: z.number().int().min(0),
    marks: z.number().int().min(1).max(20).default(1),
  })
  .refine((q) => q.answer < q.options.length, {
    message: "Mark which option is right.",
    path: ["answer"],
  });
export type QuizQuestion = z.infer<typeof Question>;

export const questionsOf = (json: string) => JSON.parse(json) as QuizQuestion[];

/** Marks earned for the chosen options (one index per question, -1 when left blank). */
export const scoreOf = (questions: QuizQuestion[], answers: number[]) =>
  questions.reduce((sum, q, i) => sum + (answers[i] === q.answer ? q.marks : 0), 0);

export const totalOf = (questions: QuizQuestion[]) => questions.reduce((s, q) => s + q.marks, 0);

/** Extra seconds allowed for a slow connection after the time is up. */
export const GRACE_MS = 60_000;
