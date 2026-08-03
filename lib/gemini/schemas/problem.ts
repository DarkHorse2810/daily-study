import { z } from "zod";

/** 1課題に複数の選択式小問をまとめる場合（英語の単語・文法ドリル等）の各小問。 */
export const SubItemSchema = z.object({
  number: z.number().int(),
  question_text: z.string(),
  choices: z.array(z.string()),
});

export type SubItem = z.infer<typeof SubItemSchema>;

export const ProblemSchema = z.object({
  problem_statement: z.string(),
  problem_type: z.enum(["multiple_choice", "short_answer", "descriptive"]),
  choices: z.array(z.string()).optional(),
  sub_items: z.array(SubItemSchema).optional(),
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
    sub_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "integer" },
          question_text: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
        },
        required: ["number", "question_text", "choices"],
      },
    },
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
