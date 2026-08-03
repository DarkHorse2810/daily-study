import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToAllSubscriptions } from "@/lib/push/webpush";
import { APP_TIMEZONE } from "@/lib/config";

/**
 * Vercel Cronのターゲット。日付が変わる少し前（23時台JST、Hobbyプランの
 * 精度上「その時間内のどこか」で実行される）に、本日分の課題で未提出のものが
 * あれば通知する。日付が変わると当日分は提出できなくなるため、その前のリマインド。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const { data: tasks } = await admin
    .from("daily_tasks")
    .select("id, submissions(id)")
    .eq("task_date", today);

  const unansweredCount = (tasks ?? []).filter(
    (task) => !task.submissions || task.submissions.length === 0,
  ).length;

  if (unansweredCount > 0) {
    await sendPushToAllSubscriptions({
      title: "daily study",
      body: `本日未提出の課題が${unansweredCount}件あります。日付が変わると提出できなくなります。`,
      url: "/dashboard",
    });
  }

  return NextResponse.json({ status: "ok", date: today, unansweredCount });
}
