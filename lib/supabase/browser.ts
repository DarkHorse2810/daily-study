import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/config";

/** クライアントコンポーネント用のSupabaseクライアント。 */
export function createClient() {
  return createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
