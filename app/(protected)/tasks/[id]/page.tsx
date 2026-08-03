import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE } from "@/lib/config";
import type { Difficulty } from "@/lib/curriculum";
import { MathText } from "@/lib/components/MathText";
import { DifficultyStars } from "@/lib/components/DifficultyStars";
import { BundledChoiceForm } from "@/lib/components/BundledChoiceForm";
import { retryGrading, submitAnswer } from "./actions";
import { AnswerForm } from "./AnswerForm";

interface SubItem {
  number: number;
  question_text: string;
  choices: string[];
}

interface TaskDetail {
  id: string;
  task_date: string;
  subject: "math" | "english";
  difficulty: number;
  problem_type: "multiple_choice" | "short_answer" | "descriptive";
  problem_statement: string;
  choices: string[] | null;
  sub_items: SubItem[] | null;
  estimated_minutes: number | null;
  unit: { name_ja: string } | { name_ja: string }[] | null;
}

interface ReviewDetail {
  is_correct: boolean;
  score: number;
  feedback: string;
  strengths: string[] | null;
  improvement_points: string[] | null;
  corrected_answer: string | null;
}

interface SubmissionDetail {
  id: string;
  answer_text: string;
  reviews: ReviewDetail | ReviewDetail[] | null;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // 2クエリはお互いに依存しないため並列実行する（レイテンシ削減）。
  const [{ data: taskData }, { data: submissionData }] = await Promise.all([
    supabase
      .from("daily_tasks")
      .select(
        "id, task_date, subject, difficulty, problem_type, problem_statement, choices, sub_items, estimated_minutes, unit:curriculum_units(name_ja)",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("submissions")
      .select(
        "id, answer_text, reviews(is_correct, score, feedback, strengths, improvement_points, corrected_answer)",
      )
      .eq("task_id", id)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!taskData) {
    notFound();
  }
  const task = taskData as unknown as TaskDetail;
  const unit = Array.isArray(task.unit) ? task.unit[0] : task.unit;
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const isToday = task.task_date === today;
  const submission = submissionData as unknown as SubmissionDetail | null;
  const review = submission
    ? Array.isArray(submission.reviews)
      ? submission.reviews[0]
      : submission.reviews
    : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-blue-600 underline">
        ← ホームに戻る
      </Link>
      <h1 className="mt-4 text-xl font-semibold">
        {task.subject === "math" ? "数学" : "英語"}・{unit?.name_ja ?? "不明"}
      </h1>
      <p className="mt-1 text-sm text-gray-500">
        難易度: <DifficultyStars difficulty={task.difficulty as Difficulty} />
        {task.estimated_minutes ? `・目安 ${task.estimated_minutes}分` : ""}
      </p>

      <section className="mt-6 rounded border bg-gray-50 p-4">
        <MathText text={task.problem_statement} className="math-text" />
      </section>

      {!submission && isToday && task.sub_items && task.sub_items.length > 0 && (
        <BundledChoiceForm
          taskId={task.id}
          subItems={task.sub_items}
          submitAction={submitAnswer}
        />
      )}

      {!submission && isToday && !(task.sub_items && task.sub_items.length > 0) && (
        <AnswerForm
          taskId={task.id}
          problemType={task.problem_type}
          choices={task.choices}
        />
      )}

      {!submission && !isToday && (
        <p className="mt-6 rounded border bg-gray-50 p-4 text-sm text-gray-600">
          この課題は本日分ではないため、解答の受付を終了しています。
        </p>
      )}

      {submission && !review && (
        <div className="mt-6 rounded border bg-yellow-50 p-4">
          <p className="text-sm text-gray-700">提出した解答:</p>
          <MathText text={submission.answer_text} className="math-text mt-1 text-sm" />
          <p className="mt-2 text-yellow-800">
            採点中です。しばらくしても表示されない場合は下のボタンで再試行してください。
          </p>
          <form action={retryGrading.bind(null, submission.id)} className="mt-3">
            <button
              type="submit"
              className="rounded bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-700"
            >
              採点を再試行
            </button>
          </form>
        </div>
      )}

      {submission && review && (
        <div className="mt-6 space-y-4">
          <div className="rounded border p-4">
            <p className="text-sm text-gray-500">あなたの解答</p>
            <MathText text={submission.answer_text} className="math-text mt-1" />
          </div>
          <div className={`rounded border p-4 ${review.is_correct ? "bg-green-50" : "bg-red-50"}`}>
            <p className="font-semibold">
              {review.is_correct ? "正解" : "不正解"} — {review.score}点
            </p>
            <MathText text={review.feedback} className="math-text mt-2" />
            {review.strengths && review.strengths.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium">良かった点</p>
                <ul className="list-disc pl-5 text-sm">
                  {review.strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {review.improvement_points && review.improvement_points.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium">改善点</p>
                <ul className="list-disc pl-5 text-sm">
                  {review.improvement_points.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {review.corrected_answer && (
              <div className="mt-3">
                <p className="text-sm font-medium">修正解答例</p>
                <MathText text={review.corrected_answer} className="math-text mt-1 text-sm" />
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
