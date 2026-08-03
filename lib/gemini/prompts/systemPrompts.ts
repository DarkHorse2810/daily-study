import { DIFFICULTY_LABELS, type Difficulty, type ProblemType, type Subject } from "@/lib/curriculum";

export function buildProblemGenerationPrompt(params: {
  subject: Subject;
  unitNameJa: string;
  difficulty: Difficulty;
  problemType: ProblemType;
  questionCount?: number;
}): string {
  const subjectLabel = params.subject === "math" ? "数学" : "英語";
  const difficultyLabel = DIFFICULTY_LABELS[params.difficulty];
  const questionCount = params.questionCount ?? 1;

  if (questionCount > 1 && params.problemType === "multiple_choice") {
    return `あなたは日本の高校生向け${subjectLabel}指導のプロフェッショナルです。
以下の条件で、オリジナルの4択の小問を${questionCount}問まとめた1つのドリル形式の課題を作成してください。

- 単元: ${params.unitNameJa}
- 難易度: ${difficultyLabel}（レベル${params.difficulty}/5）
- problem_statement には、全小問に共通する短い指示文のみを記載してください（各小問の本文はここに含めないでください）
- sub_items に、1〜${questionCount}の小問を配列で作成してください。各要素には次を含めてください:
  - number: 1から${questionCount}までの通し番号
  - question_text: その小問の本文（空欄がある場合は（　　）等で示す）
  - choices: 4つの選択肢のテキストのみの配列（①②③④等の記号は付けないでください。UI側で自動的に番号を付けます）
- choicesフィールド（トップレベル）は使わないでください
- model_answer には、各小問の正解を「1. ②」のように番号と選択肢の番号（①〜④）で全てまとめて記載してください
- solution_steps には、各小問の解説を番号に対応させて全てまとめて記載してください
- estimated_minutes は${questionCount}問全体にかかる目安時間にしてください
- 既存の入試問題の丸写しは避け、オリジナルの問題を作成してください`;
  }

  if (questionCount > 1) {
    return `あなたは日本の高校生向け${subjectLabel}指導のプロフェッショナルです。
以下の条件で、オリジナルの小問を${questionCount}問まとめた1つのドリル形式の課題を作成してください。

- 単元: ${params.unitNameJa}
- 難易度: ${difficultyLabel}（レベル${params.difficulty}/5）
- 各小問の出題形式: ${params.problemType}
- problem_statement には、（１）（２）のように全角括弧の通し番号を振った小問を、小問ごとに改行して全てまとめて記載してください
- model_answer には、各小問の正解を番号に対応させて全てまとめて記載してください
- solution_steps には、各小問の解説を番号に対応させて全てまとめて記載してください
- 数式はLaTeX記法（$...$）で記述してください
- estimated_minutes は${questionCount}問全体にかかる目安時間にしてください
- 既存の入試問題の丸写しは避け、オリジナルの問題を作成してください`;
  }

  const arithmeticGuideline =
    params.subject === "math"
      ? "\n- 計算量は共通テストで出題される程度を上限の目安にしてください。4桁以上の掛け算・割り算、繁雑な分数の通分、汚い小数が続く計算など、電卓なしでは非現実的な計算量は避けてください。難易度4〜5でも、計算の煩雑さではなく発想力・記述力の高さで差をつけてください"
      : "";

  return `あなたは日本の高校生向け${subjectLabel}指導のプロフェッショナルです。
以下の条件でオリジナルの問題を1問作成してください。

- 単元: ${params.unitNameJa}
- 難易度: ${difficultyLabel}（レベル${params.difficulty}/5）
- 出題形式: ${params.problemType}
- 数式はLaTeX記法（$...$）で記述してください
- 模範解答と、途中式・考え方を含む詳細な解説を用意してください
- 難易度4〜5の場合は、旧帝国大学（東京大学・京都大学・大阪大学等）の入試問題として通用する水準の、オリジナルかつ正確な問題にしてください
- 既存の入試問題の丸写しは避け、オリジナルの問題を作成してください${arithmeticGuideline}`;
}

export function buildGradingPrompt(params: {
  subject: Subject;
  problemStatement: string;
  modelAnswer: string;
  studentAnswer: string;
}): string {
  const subjectLabel = params.subject === "math" ? "数学" : "英語";

  return `あなたは日本の高校生向け${subjectLabel}指導のプロフェッショナルです。
以下の問題・模範解答・生徒の解答をもとに、詳細な添削を行ってください。

# 問題
${params.problemStatement}

# 模範解答
${params.modelAnswer}

# 生徒の解答
${params.studentAnswer}

正誤判定・得点（0〜100）・具体的で建設的な日本語のフィードバック・良かった点・改善点・（必要であれば）修正した解答例を作成してください。
部分点の考慮など、実際の入試採点に近い基準で評価してください。`;
}
