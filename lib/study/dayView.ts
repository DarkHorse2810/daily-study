import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Difficulty, Subject } from "@/lib/curriculum";

export type TaskStatus = "unanswered" | "grading" | "graded";

export interface DayTask {
  id: string;
  subject: Subject;
  difficulty: Difficulty;
  unitName: string;
  status: TaskStatus;
  score?: number;
}

interface TaskRow {
  id: string;
  subject: Subject;
  difficulty: number;
  unit: { name_ja: string } | { name_ja: string }[] | null;
}

interface SubmissionRow {
  task_id: string;
  reviews: { score: number } | { score: number }[] | null;
}

/**
 * 指定日のdaily_tasksを、ログインユーザーの提出・添削状況と突き合わせて返す。
 * ダッシュボード（今日）と /history/[date]（任意の日）の両方から使う共通ロジック。
 */
export async function getTasksForDate(
  supabase: SupabaseClient,
  date: string,
): Promise<DayTask[]> {
  const { data: tasksData } = await supabase
    .from("daily_tasks")
    .select("id, subject, difficulty, unit:curriculum_units(name_ja)")
    .eq("task_date", date)
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

  return tasks.map((task) => {
    const unit = Array.isArray(task.unit) ? task.unit[0] : task.unit;
    const st = statusByTaskId.get(task.id);
    return {
      id: task.id,
      subject: task.subject,
      difficulty: task.difficulty as Difficulty,
      unitName: unit?.name_ja ?? "不明",
      status: st?.status ?? "unanswered",
      score: st?.score,
    };
  });
}

export interface MonthDayStatus {
  hasTasks: boolean;
  /** その日の課題が全て提出済みか（採点完了までは待たない）。 */
  cleared: boolean;
}

/**
 * 指定月（yyyy-MM-dd の範囲）の各日について、daily_tasksの有無と全問提出済みかどうかを返す
 * （カレンダーの印付け・色分け用）。
 */
export async function getDatesWithTasks(
  supabase: SupabaseClient,
  startDate: string,
  endDate: string,
): Promise<Map<string, MonthDayStatus>> {
  const { data: tasksData } = await supabase
    .from("daily_tasks")
    .select("id, task_date")
    .gte("task_date", startDate)
    .lte("task_date", endDate);
  const tasks = (tasksData ?? []) as unknown as { id: string; task_date: string }[];

  const taskIds = tasks.map((t) => t.id);
  const { data: submissionsData } =
    taskIds.length > 0
      ? await supabase.from("submissions").select("task_id").in("task_id", taskIds)
      : { data: [] };
  const submittedTaskIds = new Set(
    ((submissionsData ?? []) as { task_id: string }[]).map((s) => s.task_id),
  );

  const counts = new Map<string, { total: number; submitted: number }>();
  for (const task of tasks) {
    const entry = counts.get(task.task_date) ?? { total: 0, submitted: 0 };
    entry.total += 1;
    if (submittedTaskIds.has(task.id)) entry.submitted += 1;
    counts.set(task.task_date, entry);
  }

  const result = new Map<string, MonthDayStatus>();
  for (const [date, { total, submitted }] of counts) {
    result.set(date, { hasTasks: total > 0, cleared: total > 0 && submitted === total });
  }
  return result;
}
