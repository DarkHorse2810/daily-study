import "server-only";
import { getGeminiClient } from "@/lib/gemini/client";
import { callWithLogging } from "@/lib/gemini/callWithLogging";
import { ProblemSchema, PROBLEM_JSON_SCHEMA, type Problem } from "@/lib/gemini/schemas/problem";
import { buildProblemGenerationPrompt } from "@/lib/gemini/prompts/systemPrompts";
import { GEMINI_MODEL_FAST, GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Difficulty, ProblemType, Subject } from "@/lib/curriculum";

export interface GenerateProblemParams {
  subject: Subject;
  unitNameJa: string;
  difficulty: Difficulty;
  problemType: ProblemType;
  /** 1課題にまとめる小問数（単語・文法ドリル等）。未指定なら1問。 */
  questionCount?: number;
}

export type GeneratedProblem = Problem & { generationModel: string };

/** 難易度4〜5は推論力の高いGEMINI_MODEL_STRONG、それ以外はGEMINI_MODEL_FASTを使う。 */
export async function generateProblem(params: GenerateProblemParams): Promise<GeneratedProblem> {
  const model = params.difficulty >= 4 ? GEMINI_MODEL_STRONG : GEMINI_MODEL_FAST;
  const client = getGeminiClient();

  const rawText = await callWithLogging(
    { model, purpose: "generate_problem" },
    async () => {
      const interaction = await client.interactions.create({
        model,
        input: buildProblemGenerationPrompt(params),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: PROBLEM_JSON_SCHEMA,
        },
      });
      const text = interaction.output_text;
      if (!text) {
        throw new Error("Gemini returned an empty response for generateProblem");
      }
      return text;
    },
  );

  const problem = ProblemSchema.parse(JSON.parse(rawText));
  return { ...problem, generationModel: model };
}
