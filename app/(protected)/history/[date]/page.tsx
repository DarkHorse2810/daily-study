import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { APP_TIMEZONE } from "@/lib/config";
import { getTasksForDate } from "@/lib/study/dayView";
import { TaskList } from "@/lib/components/TaskList";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export default async function HistoryDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!DATE_PATTERN.test(date)) {
    notFound();
  }

  const supabase = await createClient();
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const tasks = await getTasksForDate(supabase, date);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-blue-600 underline">
        ← ホームに戻る
      </Link>
      <h1 className="mt-4 text-xl font-semibold">
        {date}
        {date === today ? "（今日）" : ""}の課題
      </h1>

      {tasks.length === 0 ? (
        <p className="mt-6 text-gray-500">この日の課題はありません。</p>
      ) : (
        <TaskList tasks={tasks} />
      )}
    </main>
  );
}
