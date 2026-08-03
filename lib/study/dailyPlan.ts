import {
  ENGLISH_BUNDLE_QUESTION_COUNT,
  ENGLISH_PROBLEM_TYPE,
  ENGLISH_ROTATION_CODES,
  mathProblemType,
  SINGLE_LARGE_DIFFICULTY,
} from "@/lib/study/constants";
import type { DailyFormat, Difficulty, ProblemType, Subject } from "@/lib/curriculum";

export interface CurriculumUnitRow {
  id: string;
  code: string;
  name_ja: string;
  enabled: boolean;
}

export interface MasteryRow {
  unit_id: string;
  mastery_score: number;
  current_difficulty: number;
}

export interface GenerationOverrideRow {
  id: string;
  unit_id: string | null;
  difficulty: number | null;
}

/** 難易度(1〜5)ごとの出題数の手動指定。合計はcountと一致させること（呼び出し側で検証する）。 */
export type DifficultyDistribution = Partial<Record<Difficulty, number>>;

export interface PlannedTask {
  unitId: string;
  unitNameJa: string;
  difficulty: Difficulty;
  problemType: ProblemType;
  /** 1課題にまとめる小問数（単語・文法ドリルは10/20、それ以外は1）。 */
  questionCount: number;
}

/** 復元なし重み付き抽選。 */
function weightedSampleWithoutReplacement<T>(
  items: T[],
  weight: (item: T) => number,
  count: number,
): T[] {
  const pool = items.map((item) => ({ item, w: weight(item) }));
  const picked: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((sum, p) => sum + p.w, 0);
    let r = Math.random() * total;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      r -= pool[j].w;
      if (r <= 0) {
        idx = j;
        break;
      }
    }
    picked.push(pool[idx].item);
    pool.splice(idx, 1);
  }
  return picked;
}

/** データがない単元はDBのdefault(50)と同じ扱いにする。 */
function unitWeight(unit: CurriculumUnitRow, masteryByUnitId: Map<string, MasteryRow>): number {
  const score = masteryByUnitId.get(unit.id)?.mastery_score ?? 50;
  return Math.max(1, 101 - score);
}

function resolveDifficultyForUnit(params: {
  override: GenerationOverrideRow | null;
  unit: CurriculumUnitRow;
  dailyFormat: DailyFormat;
  masteryByUnitId: Map<string, MasteryRow>;
}): Difficulty {
  if (params.override?.difficulty != null) {
    return params.override.difficulty as Difficulty;
  }
  if (params.dailyFormat === "single_large") {
    return SINGLE_LARGE_DIFFICULTY;
  }
  const mastery = params.masteryByUnitId.get(params.unit.id);
  return (mastery?.current_difficulty ?? 2) as Difficulty;
}

function resolveProblemType(params: {
  subject: Subject;
  unit: CurriculumUnitRow;
  dailyFormat: DailyFormat;
  difficulty: Difficulty;
}): ProblemType {
  if (params.dailyFormat === "single_large") return "descriptive";
  if (params.subject === "math") return mathProblemType(params.difficulty);
  return ENGLISH_PROBLEM_TYPE[params.unit.code] ?? "short_answer";
}

function findOverrideUnit(
  units: CurriculumUnitRow[],
  override: GenerationOverrideRow,
): CurriculumUnitRow {
  const unit = units.find((u) => u.id === override.unit_id);
  if (!unit) {
    throw new Error(`generation_overrides.unit_id ${override.unit_id} not found in curriculum_units`);
  }
  return unit;
}

/** 難易度ごとの出題数の指定を、指定数ぶんの難易度の配列に展開してシャッフルする。 */
function expandAndShuffleDifficulties(
  distribution: DifficultyDistribution,
  count: number,
): Difficulty[] {
  const list: Difficulty[] = [];
  for (const level of [1, 2, 3, 4, 5] as Difficulty[]) {
    const n = distribution[level] ?? 0;
    for (let i = 0; i < n; i++) list.push(level);
  }
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, count);
}

function toPlannedTasks(
  unit: CurriculumUnitRow,
  taskCount: number,
  params: {
    subject: Subject;
    dailyFormat: DailyFormat;
    override: GenerationOverrideRow | null;
    masteryByUnitId: Map<string, MasteryRow>;
  },
  questionCount = 1,
  fixedDifficulty?: Difficulty,
): PlannedTask[] {
  const difficulty =
    fixedDifficulty ??
    resolveDifficultyForUnit({
      override: params.override,
      unit,
      dailyFormat: params.dailyFormat,
      masteryByUnitId: params.masteryByUnitId,
    });
  const problemType = resolveProblemType({
    subject: params.subject,
    unit,
    dailyFormat: params.dailyFormat,
    difficulty,
  });
  return Array.from({ length: taskCount }, () => ({
    unitId: unit.id,
    unitNameJa: unit.name_ja,
    difficulty,
    problemType,
    questionCount,
  }));
}

/**
 * 数学: subject_settings.problems_per_day（またはsingle_largeなら1）件を、
 * overrideがあれば全件同じ単元、無ければ弱点重み付けで単元ごとに1件ずつ選ぶ。
 * 弱点重み付け抽選の対象は設定画面でenabled=trueにした単元のみに絞る
 * （override指定はこのフラグに関係なく機能させるため、override解決には全単元を使う）。
 * difficultyDistribution（設定画面で指定）があれば、単元は弱点重み付けのまま、
 * 難易度だけを指定された内訳（例: ★2を3問、★3を2問）からシャッフルして割り当てる
 * （override指定時とsingle_largeモードでは、この指定より優先度が低いため使わない）。
 */
function planMathTasks(params: {
  dailyFormat: DailyFormat;
  count: number;
  override: GenerationOverrideRow | null;
  units: CurriculumUnitRow[];
  masteryByUnitId: Map<string, MasteryRow>;
  difficultyDistribution: DifficultyDistribution | null;
}): PlannedTask[] {
  if (params.override?.unit_id) {
    const overrideUnit = findOverrideUnit(params.units, params.override);
    const selectedUnits = Array.from({ length: params.count }, () => overrideUnit);
    return selectedUnits.flatMap((unit) =>
      toPlannedTasks(unit, 1, {
        subject: "math",
        dailyFormat: params.dailyFormat,
        override: params.override,
        masteryByUnitId: params.masteryByUnitId,
      }),
    );
  }

  const enabledUnits = params.units.filter((u) => u.enabled);
  const selectedUnits = weightedSampleWithoutReplacement(
    enabledUnits,
    (u) => unitWeight(u, params.masteryByUnitId),
    params.count,
  );

  if (params.dailyFormat !== "single_large" && params.difficultyDistribution) {
    const difficulties = expandAndShuffleDifficulties(params.difficultyDistribution, params.count);
    return selectedUnits.map(
      (unit, i) =>
        toPlannedTasks(
          unit,
          1,
          {
            subject: "math",
            dailyFormat: params.dailyFormat,
            override: params.override,
            masteryByUnitId: params.masteryByUnitId,
          },
          1,
          difficulties[i],
        )[0],
    );
  }

  return selectedUnits.flatMap((unit) =>
    toPlannedTasks(unit, 1, {
      subject: "math",
      dailyFormat: params.dailyFormat,
      override: params.override,
      masteryByUnitId: params.masteryByUnitId,
    }),
  );
}

/**
 * 英語: まず1カテゴリだけ選び（overrideがあればそれを、無ければ弱点重み付けでローテーション対象から）、
 * 課題は常に1件だけ作る。単語・文法カテゴリはENGLISH_BUNDLE_QUESTION_COUNTに従い、
 * その1件の中に小問を10/20問まとめたドリル形式にする（長文・英作文は小問1問のまま）。
 * subject_settings.problems_per_dayは英語には使わない。
 */
function planEnglishTasks(params: {
  dailyFormat: DailyFormat;
  override: GenerationOverrideRow | null;
  units: CurriculumUnitRow[];
  masteryByUnitId: Map<string, MasteryRow>;
}): PlannedTask[] {
  let unit: CurriculumUnitRow;
  if (params.override?.unit_id) {
    unit = findOverrideUnit(params.units, params.override);
  } else {
    const candidateUnits = params.units.filter((u) =>
      (ENGLISH_ROTATION_CODES as readonly string[]).includes(u.code),
    );
    const [picked] = weightedSampleWithoutReplacement(
      candidateUnits,
      (u) => unitWeight(u, params.masteryByUnitId),
      1,
    );
    unit = picked;
  }

  const questionCount = ENGLISH_BUNDLE_QUESTION_COUNT[unit.code] ?? 1;
  return toPlannedTasks(
    unit,
    1,
    {
      subject: "english",
      dailyFormat: params.dailyFormat,
      override: params.override,
      masteryByUnitId: params.masteryByUnitId,
    },
    questionCount,
  );
}

/**
 * 1日分の出題単元・難易度・出題形式を決定する（純粋関数、DB/API呼び出しなし）。
 * overrideのunit_idが指定されている場合は、その単元の出題数ぶん全件同じ単元にする
 * （考査直前の集中ドリル用途。英語のローテーション対象外である英文解釈も、override指定時は例外的に選べる）。
 */
export function planDailyTasks(params: {
  subject: Subject;
  dailyFormat: DailyFormat;
  count: number;
  override: GenerationOverrideRow | null;
  units: CurriculumUnitRow[];
  masteryRows: MasteryRow[];
  difficultyDistribution?: DifficultyDistribution | null;
}): PlannedTask[] {
  const masteryByUnitId = new Map(params.masteryRows.map((m) => [m.unit_id, m]));

  if (params.subject === "english") {
    return planEnglishTasks({
      dailyFormat: params.dailyFormat,
      override: params.override,
      units: params.units,
      masteryByUnitId,
    });
  }

  return planMathTasks({
    dailyFormat: params.dailyFormat,
    count: params.count,
    override: params.override,
    units: params.units,
    masteryByUnitId,
    difficultyDistribution: params.difficultyDistribution ?? null,
  });
}
