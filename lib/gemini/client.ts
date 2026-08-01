import "server-only";
import { GoogleGenAI } from "@google/genai";
import { requireEnv } from "@/lib/config";

let client: GoogleGenAI | null = null;

/** GoogleGenAIクライアントのシングルトン。GEMINI_API_KEY環境変数を利用する。 */
export function getGeminiClient(): GoogleGenAI {
  requireEnv("GEMINI_API_KEY");
  if (!client) {
    client = new GoogleGenAI({});
  }
  return client;
}
