import {
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

export interface PlannedTask {
  unitId: string;
  unitNameJa: string;
  difficulty: Difficulty;
  problemType: ProblemType;
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

/**
 * 1日分の出題単元・難易度・出題形式を決定する（純粋関数、DB/API呼び出しなし）。
 * overrideのunit_idが指定されている場合は、count件すべてその単元にする
 * （考査直前の集中ドリル用途。英語のローテーション対象外である英文解釈も、override指定時は例外的に選べる）。
 */
export function planDailyTasks(params: {
  subject: Subject;
  dailyFormat: DailyFormat;
  count: number;
  override: GenerationOverrideRow | null;
  units: CurriculumUnitRow[];
  masteryRows: MasteryRow[];
}): PlannedTask[] {
  const masteryByUnitId = new Map(params.masteryRows.map((m) => [m.unit_id, m]));

  let selectedUnits: CurriculumUnitRow[];
  if (params.override?.unit_id) {
    const overrideUnit = params.units.find((u) => u.id === params.override!.unit_id);
    if (!overrideUnit) {
      throw new Error(
        `generation_overrides.unit_id ${params.override.unit_id} not found in curriculum_units`,
      );
    }
    selectedUnits = Array.from({ length: params.count }, () => overrideUnit);
  } else {
    const candidateUnits =
      params.subject === "english"
        ? params.units.filter((u) => (ENGLISH_ROTATION_CODES as readonly string[]).includes(u.code))
        : params.units;
    selectedUnits = weightedSampleWithoutReplacement(
      candidateUnits,
      (u) => unitWeight(u, masteryByUnitId),
      params.count,
    );
  }

  return selectedUnits.map((unit) => {
    const difficulty = resolveDifficultyForUnit({
      override: params.override,
      unit,
      dailyFormat: params.dailyFormat,
      masteryByUnitId,
    });
    const problemType = resolveProblemType({
      subject: params.subject,
      unit,
      dailyFormat: params.dailyFormat,
      difficulty,
    });
    return { unitId: unit.id, unitNameJa: unit.name_ja, difficulty, problemType };
  });
}
