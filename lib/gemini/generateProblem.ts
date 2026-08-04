import "server-only";
import { getGeminiClient } from "@/lib/gemini/client";
import { callWithLogging } from "@/lib/gemini/callWithLogging";
import { ProblemSchema, PROBLEM_JSON_SCHEMA, type Problem } from "@/lib/gemini/schemas/problem";
import { buildProblemGenerationPrompt } from "@/lib/gemini/prompts/systemPrompts";
import { GEMINI_MODEL_FAST, GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Difficulty, ProblemType, Subject } from "@/lib/curriculum";

export interface GenerateProblemParams {
  subject: Subject;
  unitNameJa: string;
  difficulty: Difficulty;
  problemType: ProblemType;
  /** 1課題にまとめる小問数（単語・文法ドリル等）。未指定なら1問。 */
  questionCount?: number;
}

export type GeneratedProblem = Problem & { generationModel: string };

// cronは複数件を並列生成するため、1件が異常に長く応答しない場合に備えて
// 個別にタイムアウトを設ける（Vercelの実行時間上限を1件の遅延で使い切らないため）。
// SDK側の自動リトライも無効化し、遅延の積み重ねを防ぐ。
// 25秒では難易度4〜5（GEMINI_MODEL_STRONG）の生成が間に合わないことが多かったため、
// 並列実行かつVercelの60秒上限にまだ余裕があることを踏まえて45秒に緩和した。
const GENERATE_TIMEOUT_MS = 45_000;

/**
 * プロンプトで「試行錯誤を出力に含めない」よう指示しても、モデルが無視して
 * 「あれ？」等の迷い・自己修正の過程をそのまま出力し、model_answerとsolution_stepsが
 * 矛盾したまま返ってくることがある。プロンプトだけでは防げないため、
 * 生成結果にこれらの兆候がないか検証し、あれば1回だけ再生成する。
 */
const SELF_CORRECTION_MARKERS = [
  "あれ？",
  "あれ、",
  "もう一度確認",
  "もう一度見直",
  "もう一度、",
  "訂正します",
  "訂正する",
  "見直します",
  "見直そう",
  "見直す",
  "ちょっと待って",
  "待てよ",
  "失礼、",
  "失礼しました",
  "再設計",
  "再度検討",
  "修正しよう",
  "修正版",
  "書き直す",
  "書き直そう",
  "汚い",
  "中途半端",
  "確定した問題",
  "確定する",
  "調整版",
  "問題文の再掲",
  "試行錯誤",
];

// キーワード一致だけでは、別解の模索や問題設定の作り直しをすり抜けることがある
// （実例: 数値を何度も変えながら最終的に落ち着いた設定を採用したケースで、
// model_answerとsolution_stepsの結論が食い違ったまま検出をすり抜けた）。
// 正常な解説は概ねこの文字数に収まるため、長すぎる場合も試行錯誤の混入を疑い再生成する。
const SOLUTION_STEPS_LENGTH_LIMIT = 1200;

function hasSelfCorrectionArtifacts(problem: Problem, questionCount: number): boolean {
  const combined = [
    problem.problem_statement,
    problem.model_answer,
    problem.solution_steps,
    ...(problem.sub_items?.map((s) => s.question_text) ?? []),
  ].join("\n");
  if (SELF_CORRECTION_MARKERS.some((marker) => combined.includes(marker))) {
    return true;
  }
  // 単語・文法ドリル等（questionCount>1）はsolution_stepsが小問数ぶん長くなって当然なので、
  // 長さチェックは1問だけの通常課題に限定する。
  if (questionCount > 1) {
    return false;
  }
  return problem.solution_steps.length > SOLUTION_STEPS_LENGTH_LIMIT;
}

async function requestProblem(
  params: GenerateProblemParams,
  model: string,
  client: ReturnType<typeof getGeminiClient>,
): Promise<Problem> {
  const rawText = await callWithLogging(
    { model, purpose: "generate_problem" },
    async () => {
      const interaction = await client.interactions.create(
        {
          model,
          input: buildProblemGenerationPrompt(params),
          response_format: {
            type: "text",
            mime_type: "application/json",
            schema: PROBLEM_JSON_SCHEMA,
          },
        },
        { timeout_ms: GENERATE_TIMEOUT_MS, retries: { strategy: "none" } },
      );
      const text = interaction.output_text;
      if (!text) {
        throw new Error("Gemini returned an empty response for generateProblem");
      }
      return text;
    },
  );

  return ProblemSchema.parse(JSON.parse(rawText));
}

/** 難易度4〜5は推論力の高いGEMINI_MODEL_STRONG、それ以外はGEMINI_MODEL_FASTを使う。 */
export async function generateProblem(params: GenerateProblemParams): Promise<GeneratedProblem> {
  const model = params.difficulty >= 4 ? GEMINI_MODEL_STRONG : GEMINI_MODEL_FAST;
  const client = getGeminiClient();

  const questionCount = params.questionCount ?? 1;

  const first = await requestProblem(params, model, client);
  if (!hasSelfCorrectionArtifacts(first, questionCount)) {
    return { ...first, generationModel: model };
  }

  console.warn("generateProblem: self-correction artifacts detected, retrying once", {
    unitNameJa: params.unitNameJa,
    difficulty: params.difficulty,
  });
  const retry = await requestProblem(params, model, client);
  if (hasSelfCorrectionArtifacts(retry, questionCount)) {
    throw new Error("生成結果に試行錯誤の混入が検出されたため中止しました（再生成後も改善せず）");
  }
  return { ...retry, generationModel: model };
}
