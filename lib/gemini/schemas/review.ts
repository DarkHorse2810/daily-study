import { z } from "zod";

export const ReviewSchema = z.object({
  is_correct: z.boolean(),
  score: z.number().min(0).max(100),
  feedback: z.string(),
  strengths: z.array(z.string()).optional(),
  improvement_points: z.array(z.string()).optional(),
  corrected_answer: z.string().optional(),
});

export type Review = z.infer<typeof ReviewSchema>;

export const REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    is_correct: { type: "boolean" },
    score: { type: "number" },
    feedback: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    improvement_points: { type: "array", items: { type: "string" } },
    corrected_answer: { type: "string" },
  },
  required: ["is_correct", "score", "feedback"],
} as const;
