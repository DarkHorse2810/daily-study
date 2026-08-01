import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 本日（UTC日境界の簡易実装）のGemini API呼び出し件数をモデル別に返す。
 * Google公式の正確な残数ではなく、あくまでアプリ側の自己記録に基づく目安。
 * TODO(Phase 2): APP_TIMEZONE(Asia/Tokyo)基準の日境界にdate-fns-tzで厳密化する。
 */
export async function GET() {
  const supabase = createAdminClient();

  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from("api_usage_log")
    .select("model, purpose, status")
    .gte("called_at", startOfToday.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const byModel: Record<string, number> = {};
  for (const row of data) {
    byModel[row.model] = (byModel[row.model] ?? 0) + 1;
  }

  return NextResponse.json({ totalCalls: data.length, byModel });
}
