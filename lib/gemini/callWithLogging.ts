import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface CallMeta {
  model: string;
  purpose: "generate_problem" | "grade_submission" | "transcribe_image";
}

/**
 * Gemini API呼び出しをラップし、成否をapi_usage_logに記録する。
 * 429（レート制限超過）は status='rate_limited' として記録し、呼び出し元にエラーを伝播する。
 */
export async function callWithLogging<T>(meta: CallMeta, fn: () => Promise<T>): Promise<T> {
  const supabase = createAdminClient();

  try {
    const result = await fn();
    await supabase.from("api_usage_log").insert({
      model: meta.model,
      purpose: meta.purpose,
      status: "success",
    });
    return result;
  } catch (error) {
    const httpStatus = extractHttpStatus(error);
    await supabase.from("api_usage_log").insert({
      model: meta.model,
      purpose: meta.purpose,
      status: httpStatus === 429 ? "rate_limited" : "error",
      http_status: httpStatus ?? null,
      error_message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function extractHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    if (typeof obj.status === "number") return obj.status;
    if (typeof obj.code === "number") return obj.code;
  }
  return undefined;
}
