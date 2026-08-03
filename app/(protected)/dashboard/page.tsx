import Link from "next/link";
import { formatInTimeZone } from "date-fns-tz";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE, GEMINI_RATE_LIMIT_DASHBOARD_URL } from "@/lib/config";
import { getTasksForDate, getDatesWithTasks } from "@/lib/study/dayView";
import { TaskList } from "@/lib/components/TaskList";
import { CalendarMonth } from "@/lib/components/CalendarMonth";
import { logout } from "../actions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const supabase = await createClient();

  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const monthStr = month && /^\d{4}-\d{2}$/.test(month) ? month : today.slice(0, 7);
  const monthStart = startOfMonth(new Date(`${monthStr}-01T00:00:00`));
  const monthEnd = endOfMonth(monthStart);

  const [
    {
      data: { user },
    },
    tasks,
    datesWithTasks,
  ] = await Promise.all([
    supabase.auth.getUser(),
    getTasksForDate(supabase, today),
    getDatesWithTasks(supabase, format(monthStart, "yyyy-MM-dd"), format(monthEnd, "yyyy-MM-dd")),
  ]);

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
        <>
          {tasks.every((t) => t.status !== "unanswered") && (
            <p className="mt-6 rounded border border-green-200 bg-green-50 px-4 py-3 font-medium text-green-800">
              🎉 今日の課題をクリアしました！
            </p>
          )}
          <TaskList tasks={tasks} />
        </>
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

      <CalendarMonth monthStr={monthStr} todayStr={today} datesWithTasks={datesWithTasks} />

      <Link
        href="/settings"
        className="mt-6 flex items-center justify-center gap-2 rounded border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        ⚙️ 設定
      </Link>
    </main>
  );
}
