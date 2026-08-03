import "server-only";
import { getGeminiClient } from "@/lib/gemini/client";
import { callWithLogging } from "@/lib/gemini/callWithLogging";
import { ReviewSchema, REVIEW_JSON_SCHEMA, type Review } from "@/lib/gemini/schemas/review";
import { buildGradingPrompt, buildImageGradingPrompt } from "@/lib/gemini/prompts/systemPrompts";
import { GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Subject } from "@/lib/curriculum";

interface GradeSubmissionTextParams {
  subject: Subject;
  problemStatement: string;
  modelAnswer: string;
  studentAnswer: string;
}

interface GradeSubmissionImageParams {
  subject: Subject;
  problemStatement: string;
  modelAnswer: string;
  studentAnswerImage: { base64: string; mimeType: string };
}

export type GradeSubmissionParams = GradeSubmissionTextParams | GradeSubmissionImageParams;

/**
 * 添削は正確性が重要なため、常にGEMINI_MODEL_STRONGを使う。
 * 写真提出の場合は、文字起こしと添削を1回の呼び出しでまとめて行う
 * （2回に分けるより高速で、レート制限の消費も抑えられる）。
 */
export async function gradeSubmission(params: GradeSubmissionParams): Promise<Review> {
  const model = GEMINI_MODEL_STRONG;
  const client = getGeminiClient();
  const isImage = "studentAnswerImage" in params;

  const rawText = await callWithLogging(
    { model, purpose: "grade_submission" },
    async () => {
      const interaction = await client.interactions.create({
        model,
        input: isImage
          ? [
              {
                type: "user_input" as const,
                content: [
                  { type: "text" as const, text: buildImageGradingPrompt(params) },
                  {
                    type: "image" as const,
                    data: params.studentAnswerImage.base64,
                    mime_type: params.studentAnswerImage.mimeType,
                  },
                ],
              },
            ]
          : buildGradingPrompt(params),
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
