import "server-only";
import { getGeminiClient } from "@/lib/gemini/client";
import { callWithLogging } from "@/lib/gemini/callWithLogging";
import { ReviewSchema, REVIEW_JSON_SCHEMA, type Review } from "@/lib/gemini/schemas/review";
import { buildGradingPrompt, buildImageGradingPrompt, type GradingSubItem } from "@/lib/gemini/prompts/systemPrompts";
import { GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Subject } from "@/lib/curriculum";

interface GradeSubmissionTextParams {
  subject: Subject;
  problemStatement: string;
  modelAnswer: string;
  studentAnswer: string;
  subItems?: GradingSubItem[] | null;
}

interface GradeSubmissionImageParams {
  subject: Subject;
  problemStatement: string;
  modelAnswer: string;
  studentAnswerImage: { base64: string; mimeType: string };
}

export type GradeSubmissionParams = GradeSubmissionTextParams | GradeSubmissionImageParams;

// 1回の応答が異常に長引いた場合でも、ページ側のmaxDuration（60秒）内で
// 「採点中」表示に落ち着けるよう、SDK呼び出し自体にタイムアウトを設ける。
const GRADE_TIMEOUT_MS = 40_000;

/**
 * 写真提出の添削で、Geminiが暴走してJSON構造やメタ的な相槌（「以上です」「JSON出力完了」等）を
 * 何度も繰り返し、transcribed_answerに大量の余計なテキストが混入することがあったため検証する。
 * 通常の手書き解答の書き起こしがこの長さを超えることはまず無い。
 */
const TRANSCRIBED_ANSWER_LENGTH_LIMIT = 1500;
const CORRUPTION_MARKERS = [
  "```json",
  "JSON出力",
  "JSONスキーマ",
  "以上です",
  "以上となります",
  "指導プロフェッショナル",
  "添削完了",
  "添削終了",
  "ご確認よろしくお願いいたします",
  "ご査収",
  "ご一読ありがとうございました",
];

function hasCorruptedTranscription(review: Review): boolean {
  const transcribed = review.transcribed_answer;
  if (!transcribed) return false;
  if (transcribed.length > TRANSCRIBED_ANSWER_LENGTH_LIMIT) return true;
  return CORRUPTION_MARKERS.some((marker) => transcribed.includes(marker));
}

async function requestReview(params: GradeSubmissionParams, model: string, client: ReturnType<typeof getGeminiClient>): Promise<Review> {
  const isImage = "studentAnswerImage" in params;
  const rawText = await callWithLogging(
    { model, purpose: "grade_submission" },
    async () => {
      const interaction = await client.interactions.create(
        {
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
        },
        { timeout_ms: GRADE_TIMEOUT_MS, retries: { strategy: "none" } },
      );
      const text = interaction.output_text;
      if (!text) {
        throw new Error("Gemini returned an empty response for gradeSubmission");
      }
      return text;
    },
  );

  return ReviewSchema.parse(JSON.parse(rawText));
}

/**
 * 添削は正確性が重要なため、常にGEMINI_MODEL_STRONGを使う。
 * 写真提出の場合は、文字起こしと添削を1回の呼び出しでまとめて行う
 * （2回に分けるより高速で、レート制限の消費も抑えられる）。
 * transcribed_answerにメタ的な繰り返し出力等の混入が検出された場合は1回だけ再試行する。
 */
export async function gradeSubmission(params: GradeSubmissionParams): Promise<Review> {
  const model = GEMINI_MODEL_STRONG;
  const client = getGeminiClient();

  const first = await requestReview(params, model, client);
  if (!hasCorruptedTranscription(first)) {
    return first;
  }

  console.warn("gradeSubmission: corrupted transcribed_answer detected, retrying once");
  const retry = await requestReview(params, model, client);
  if (hasCorruptedTranscription(retry)) {
    throw new Error("写真の読み取り結果が不安定なため中止しました。もう一度撮り直してお試しください。");
  }
  return retry;
}
