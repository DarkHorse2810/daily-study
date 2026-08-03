export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Tokyo";

// gemini-2.5-* 系（flash/pro/flash-lite）は新規アカウントでは404（新規ユーザー非対応）または
// 無料枠クォータ0で使用不可なことを実機確認済み。gemini-3.x系のflash系モデルのみ動作する。
export const GEMINI_MODEL_FAST = process.env.GEMINI_MODEL_FAST ?? "gemini-3.5-flash-lite";
export const GEMINI_MODEL_STRONG = process.env.GEMINI_MODEL_STRONG ?? "gemini-3.6-flash";

/** Google公式のレート制限確認ページ。api_usage_log による自己記録はあくまで目安であり、正確な残数はここで確認する。 */
export const GEMINI_RATE_LIMIT_DASHBOARD_URL = "https://aistudio.google.com/rate-limit";

// Web Push通知用のVAPID鍵（npx web-push generate-vapid-keysで生成）。
export const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? "";
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? "";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
