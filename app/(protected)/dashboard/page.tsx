import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE, GEMINI_RATE_LIMIT_DASHBOARD_URL } from "@/lib/config";
import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/curriculum";
import { logout } from "../actions";

type TaskStatus = "unanswered" | "grading" | "graded";

// Supabaseクライアントに型生成(supabase gen types)を導入していないため、
// クエリ結果はunknown経由でこの型にキャストする。
interface TaskRow {
  id: string;
  subject: "math" | "english";
  difficulty: number;
  unit: { name_ja: string } | { name_ja: string }[] | null;
}

interface SubmissionRow {
  task_id: string;
  reviews: { score: number } | { score: number }[] | null;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const { data: tasksData } = await supabase
    .from("daily_tasks")
    .select("id, subject, difficulty, unit:curriculum_units(name_ja)")
    .eq("task_date", today)
    .order("subject");
  const tasks = (tasksData ?? []) as unknown as TaskRow[];

  const taskIds = tasks.map((t) => t.id);
  const { data: submissionsData } =
    taskIds.length > 0
      ? await supabase.from("submissions").select("task_id, reviews(score)").in("task_id", taskIds)
      : { data: [] };
  const submissions = (submissionsData ?? []) as unknown as SubmissionRow[];

  const statusByTaskId = new Map<string, { status: TaskStatus; score?: number }>();
  for (const s of submissions) {
    const review = Array.isArray(s.reviews) ? s.reviews[0] : s.reviews;
    statusByTaskId.set(
      s.task_id,
      review ? { status: "graded", score: review.score } : { status: "grading" },
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">今日の課題</h1>
        <form action={logout}>
          <button type="submit" className="text-sm text-gray-500 underline">
            ログアウト
          </button>
        </form>
      </div>
      <p className="mt-2 text-sm text-gray-600">
        {user?.email} でログイン中・{today}
      </p>

      {tasks.length === 0 ? (
        <p className="mt-6 text-gray-500">
          本日の課題はまだ生成されていません。毎朝6時（JST）に自動生成されます。
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {tasks.map((task) => {
            const unit = Array.isArray(task.unit) ? task.unit[0] : task.unit;
            const status = statusByTaskId.get(task.id);
            return (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="flex items-center justify-between rounded border p-4 hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">
                      {task.subject === "math" ? "数学" : "英語"}・{unit?.name_ja ?? "不明"}
                    </p>
                    <p className="text-sm text-gray-500">
                      難易度: {DIFFICULTY_LABELS[task.difficulty as Difficulty]}
                    </p>
                  </div>
                  <StatusBadge status={status?.status ?? "unanswered"} score={status?.score} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 text-sm text-gray-500">
        Gemini APIの無料枠のレート制限は、
        <a
          href={GEMINI_RATE_LIMIT_DASHBOARD_URL}
          target="_blank"
          rel="noreferrer"
          className="text-blue-600 underline"
        >
          Google AI Studio
        </a>
        で正確な数値を確認できます（アプリ内の記録はあくまで目安）。
      </p>
    </main>
  );
}

function StatusBadge({ status, score }: { status: TaskStatus; score?: number }) {
  if (status === "graded") {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
        {score}点
      </span>
    );
  }
  if (status === "grading") {
    return (
      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm text-yellow-800">
        採点中
      </span>
    );
  }
  return (
    <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">未回答</span>
  );
}
