import "server-only";
import { z } from "zod";
import { getGeminiClient } from "@/lib/gemini/client";
import { callWithLogging } from "@/lib/gemini/callWithLogging";
import { GEMINI_MODEL_FAST } from "@/lib/config";

const TranscriptionSchema = z.object({
  transcribed_text: z.string(),
});

const TRANSCRIPTION_JSON_SCHEMA = {
  type: "object",
  properties: {
    transcribed_text: { type: "string" },
  },
  required: ["transcribed_text"],
} as const;

const TRANSCRIBE_PROMPT =
  "この画像には、紙に手書きした解答が写っています。書かれている内容をそのまま忠実にテキストへ書き起こしてください。" +
  "数式はLaTeX記法（$...$）で表記してください。解答の内容以外の説明・前置きは含めず、書き起こしたテキストのみを出力してください。";

export interface TranscribeAnswerImageParams {
  base64: string;
  mimeType: string;
}

/** 手書き解答の写真をGeminiに読み取らせ、テキストに書き起こす。 */
export async function transcribeAnswerImage(
  params: TranscribeAnswerImageParams,
): Promise<string> {
  const model = GEMINI_MODEL_FAST;
  const client = getGeminiClient();

  const rawText = await callWithLogging(
    { model, purpose: "transcribe_image" },
    async () => {
      const interaction = await client.interactions.create({
        model,
        input: [
          {
            role: "user",
            content: [
              { type: "text", text: TRANSCRIBE_PROMPT },
              { type: "image", data: params.base64, mime_type: params.mimeType },
            ],
          },
        ],
        response_format: {
          type: "text",
          mime_type: "application/json",
          schema: TRANSCRIPTION_JSON_SCHEMA,
        },
      });
      const text = interaction.output_text;
      if (!text) {
        throw new Error("Gemini returned an empty response for transcribeAnswerImage");
      }
      return text;
    },
  );

  return TranscriptionSchema.parse(JSON.parse(rawText)).transcribed_text;
}
