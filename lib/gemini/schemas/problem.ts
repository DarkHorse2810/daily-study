import { z } from "zod";

export const ProblemSchema = z.object({
  problem_statement: z.string(),
  problem_type: z.enum(["multiple_choice", "short_answer", "descriptive"]),
  choices: z.array(z.string()).optional(),
  model_answer: z.string(),
  solution_steps: z.string(),
  estimated_minutes: z.number().int(),
});

export type Problem = z.infer<typeof ProblemSchema>;

/** response_format.schema に渡すJSON Schema（ProblemSchemaと同じ形を手書き）。 */
export const PROBLEM_JSON_SCHEMA = {
  type: "object",
  properties: {
    problem_statement: { type: "string" },
    problem_type: {
      type: "string",
      enum: ["multiple_choice", "short_answer", "descriptive"],
    },
    choices: { type: "array", items: { type: "string" } },
    model_answer: { type: "string" },
    solution_steps: { type: "string" },
    estimated_minutes: { type: "integer" },
  },
  required: [
    "problem_statement",
    "problem_type",
    "model_answer",
    "solution_steps",
    "estimated_minutes",
  ],
} as const;
