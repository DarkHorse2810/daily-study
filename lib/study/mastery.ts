import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { bucketDifficulty, clamp, MASTERY_EMA_MIN_ALPHA } from "@/lib/study/constants";
import type { Difficulty } from "@/lib/curriculum";
import type { Review } from "@/lib/gemini/schemas/review";

export interface MasteryUpdateInput {
  mastery_score: number;
  current_difficulty: number;
  attempts_count: number;
  correct_count: number;
}

export interface MasteryUpdateResult {
  mastery_score: number;
  current_difficulty: Difficulty;
  attempts_count: number;
  correct_count: number;
  last_practiced_at: string;
}

/**
 * 習熟度スコア・難易度の更新量を計算する（純粋関数）。
 * EMA的に更新し、1回の結果で難易度が2段階以上動かないようクランプする。
 */
export function computeMasteryUpdate(
  existing: MasteryUpdateInput | null,
  review: Pick<Review, "is_correct" | "score">,
): MasteryUpdateResult {
  const oldScore = existing?.mastery_score ?? 50;
  const oldDifficulty = existing?.current_difficulty ?? 2;
  const attempts = (existing?.attempts_count ?? 0) + 1;
  const correct = (existing?.correct_count ?? 0) + (review.is_correct ? 1 : 0);

  const alpha = Math.max(MASTERY_EMA_MIN_ALPHA, 1 / attempts);
  const newScore = clamp(oldScore * (1 - alpha) + review.score * alpha, 0, 100);

  const bucketed = bucketDifficulty(newScore);
  const newDifficulty = clamp(bucketed, oldDifficulty - 1, oldDifficulty + 1) as Difficulty;

  return {
    mastery_score: newScore,
    current_difficulty: newDifficulty,
    attempts_count: attempts,
    correct_count: correct,
    last_practiced_at: new Date().toISOString(),
  };
}

/** 添削確定後にuser_topic_masteryへ反映する（select→計算→upsert、service-roleクライアント使用）。 */
export async function applyMasteryUpdate(params: {
  userId: string;
  unitId: string;
  review: Pick<Review, "is_correct" | "score">;
}): Promise<void> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("user_topic_mastery")
    .select("mastery_score, current_difficulty, attempts_count, correct_count")
    .eq("user_id", params.userId)
    .eq("unit_id", params.unitId)
    .maybeSingle();

  const update = computeMasteryUpdate(existing, params.review);

  const { error } = await admin.from("user_topic_mastery").upsert(
    {
      user_id: params.userId,
      unit_id: params.unitId,
      ...update,
    },
    { onConflict: "user_id,unit_id" },
  );

  if (error) {
    throw new Error(`Failed to update user_topic_mastery: ${error.message}`);
  }
}
