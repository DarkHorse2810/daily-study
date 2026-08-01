import "server-only";
import { getGeminiClient } from "@/lib/gemini/client";
import { callWithLogging } from "@/lib/gemini/callWithLogging";
import { ReviewSchema, REVIEW_JSON_SCHEMA, type Review } from "@/lib/gemini/schemas/review";
import { buildGradingPrompt } from "@/lib/gemini/prompts/systemPrompts";
import { GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Subject } from "@/lib/curriculum";

export interface GradeSubmissionParams {
  subject: Subject;
  problemStatement: string;
  modelAnswer: string;
  studentAnswer: string;
}

/** 添削は正確性が重要なため、常にGEMINI_MODEL_STRONGを使う。 */
export async function gradeSubmission(params: GradeSubmissionParams): Promise<Review> {
  const model = GEMINI_MODEL_STRONG;
  const client = getGeminiClient();

  const rawText = await callWithLogging(
    { model, purpose: "grade_submission" },
    async () => {
      const interaction = await client.interactions.create({
        model,
        input: buildGradingPrompt(params),
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: REVIEW_JSON_SCHEMA,
        },
      });
      const text = interaction.output_text;
      if (!text) {
        throw new Error("Gemini returned an empty response for gradeSubmission");
      }
      return text;
    },
  );

  return ReviewSchema.parse(JSON.parse(rawText));
}
