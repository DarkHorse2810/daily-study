import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/config";

/**
 * service-roleキーを使うサーバー専用クライアント。RLSをバイパスするため、
 * cronジョブや管理用の書き込み（daily_tasks, reviews, api_usage_log等）にのみ使用する。
 * クライアントコンポーネントやServer Actionのユーザー操作には使わないこと。
 */
export function createAdminClient() {
  return createSupabaseClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
