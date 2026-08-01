export type Subject = "math" | "english";

export interface CurriculumUnit {
  code: string;
  subject: Subject;
  nameJa: string;
  sortOrder: number;
}

/**
 * カリキュラムの単一の情報源。supabase/migrations/0001_init.sql の
 * curriculum_units seed とコード（code列）を一致させること。
 */
export const CURRICULUM_UNITS: CurriculumUnit[] = [
  // 数学（現行課程・数C含む）
  { code: "math1_expressions", subject: "math", nameJa: "数と式", sortOrder: 1 },
  { code: "math1_sets_logic", subject: "math", nameJa: "集合と命題", sortOrder: 2 },
  { code: "math1_quadratic", subject: "math", nameJa: "二次関数", sortOrder: 3 },
  { code: "math1_trig_ratio", subject: "math", nameJa: "図形と計量（三角比）", sortOrder: 4 },
  { code: "math1_data", subject: "math", nameJa: "データの分析", sortOrder: 5 },
  { code: "mathA_combinatorics_prob", subject: "math", nameJa: "場合の数と確率", sortOrder: 6 },
  { code: "mathA_integers", subject: "math", nameJa: "整数の性質", sortOrder: 7 },
  { code: "mathA_plane_geometry", subject: "math", nameJa: "図形の性質", sortOrder: 8 },
  { code: "math2_equations_complex", subject: "math", nameJa: "式と証明・複素数と方程式", sortOrder: 9 },
  { code: "math2_coordinate_geometry", subject: "math", nameJa: "図形と方程式", sortOrder: 10 },
  { code: "math2_trig_functions", subject: "math", nameJa: "三角関数", sortOrder: 11 },
  { code: "math2_exp_log", subject: "math", nameJa: "指数関数・対数関数", sortOrder: 12 },
  { code: "math2_calculus", subject: "math", nameJa: "微分法・積分法（数II）", sortOrder: 13 },
  { code: "mathB_sequences", subject: "math", nameJa: "数列", sortOrder: 14 },
  { code: "mathB_stats_inference", subject: "math", nameJa: "統計的な推測", sortOrder: 15 },
  { code: "mathC_vectors", subject: "math", nameJa: "ベクトル", sortOrder: 16 },
  { code: "mathC_curves_complex_plane", subject: "math", nameJa: "平面上の曲線と複素数平面", sortOrder: 17 },
  { code: "math3_limits", subject: "math", nameJa: "極限", sortOrder: 18 },
  { code: "math3_calculus_diff", subject: "math", nameJa: "微分法（数III）", sortOrder: 19 },
  { code: "math3_calculus_int", subject: "math", nameJa: "積分法（数III）", sortOrder: 20 },

  // 英語
  { code: "eng_reading", subject: "english", nameJa: "長文読解", sortOrder: 1 },
  { code: "eng_grammar_usage", subject: "english", nameJa: "英文法・語法", sortOrder: 2 },
  { code: "eng_writing", subject: "english", nameJa: "英作文", sortOrder: 3 },
  { code: "eng_vocabulary", subject: "english", nameJa: "語彙・イディオム", sortOrder: 4 },
  { code: "eng_interpretation", subject: "english", nameJa: "英文解釈・構文把握", sortOrder: 5 },
];

export type Difficulty = 1 | 2 | 3 | 4 | 5;

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  1: "基礎・教科書レベル",
  2: "標準・共通テストレベル",
  3: "応用・入試標準レベル",
  4: "発展・旧帝大標準レベル",
  5: "最難関・旧帝大応用/記述論述レベル",
};

export type ProblemType = "multiple_choice" | "short_answer" | "descriptive";

export type DailyFormat = "multiple_small" | "single_large";

export function unitsForSubject(subject: Subject): CurriculumUnit[] {
  return CURRICULUM_UNITS.filter((u) => u.subject === subject).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}
