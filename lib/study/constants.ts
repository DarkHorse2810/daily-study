import type { Difficulty, ProblemType } from "@/lib/curriculum";

/** single_large（大問）モードで生成する問題の固定難易度。 */
export const SINGLE_LARGE_DIFFICULTY: Difficulty = 4;

/** 習熟度スコアのEMA更新で、新しい結果を反映する割合の下限（1/attemptsがこれを下回らないようにする）。 */
export const MASTERY_EMA_MIN_ALPHA = 0.3;

/** 習熟度スコア(0-100)から難易度(1-5)へのバケット分け閾値。 */
export function bucketDifficulty(score: number): Difficulty {
  if (score < 30) return 1;
  if (score < 50) return 2;
  if (score < 70) return 3;
  if (score < 85) return 4;
  return 5;
}

/** 英語の自動ローテーション対象の単元コード（英文解釈は含まない。overrideで明示指定された場合のみ例外）。 */
export const ENGLISH_ROTATION_CODES = [
  "eng_vocabulary",
  "eng_grammar_usage",
  "eng_writing",
  "eng_reading",
] as const;

/** 英語カテゴリごとの出題形式（実際の入試形式に近い形を固定で割り当てる）。 */
export const ENGLISH_PROBLEM_TYPE: Record<string, ProblemType> = {
  eng_vocabulary: "multiple_choice",
  eng_grammar_usage: "multiple_choice",
  eng_reading: "short_answer",
  eng_writing: "descriptive",
  eng_interpretation: "short_answer",
};

/**
 * 英語はカテゴリごとに1日の出題数を変える（単語・文法は短時間で数をこなすドリル形式、
 * 長文・英作文は1問あたりの負荷が高いため少数のまま）。subject_settings.problems_per_day
 * は英語には使わず、この定数で決める。
 */
export const ENGLISH_PROBLEMS_PER_DAY: Record<string, number> = {
  eng_vocabulary: 20,
  eng_grammar_usage: 10,
  eng_reading: 1,
  eng_writing: 1,
  eng_interpretation: 1,
};

/** 数学の出題形式を難易度から解決する（旧帝大レベルの数学はほぼ記述式のためmultiple_choiceは使わない）。 */
export function mathProblemType(difficulty: Difficulty): ProblemType {
  return difficulty >= 4 ? "descriptive" : "short_answer";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
