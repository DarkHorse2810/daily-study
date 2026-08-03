import { NextResponse } from "next/server";
import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateProblem } from "@/lib/gemini/generateProblem";
import { APP_TIMEZONE } from "@/lib/config";
import {
  planDailyTasks,
  type CurriculumUnitRow,
  type GenerationOverrideRow,
  type MasteryRow,
} from "@/lib/study/dailyPlan";
import type { Subject } from "@/lib/curriculum";

const SUBJECTS: Subject[] = ["math", "english"];
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Vercel Cronのターゲット。Vercelは CRON_SECRET が設定されている場合、
 * 呼び出し時に自動で `Authorization: Bearer $CRON_SECRET` ヘッダーを付与する。
 *
 * 教科ごとに独立してtry/catchし、片方が失敗してももう片方は実行する。
 * 同日に複数回叩かれても（Vercelの再試行・手動再実行）冪等になるよう、
 * 既にその日・教科のdaily_tasksがあればスキップする。
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");

  const results: Record<string, unknown> = {};
  for (const subject of SUBJECTS) {
    results[subject] = await generateForSubject(admin, subject, today);
  }

  return NextResponse.json({ status: "ok", date: today, results });
}

async function generateForSubject(admin: AdminClient, subject: Subject, today: string) {
  const { data: runRow } = await admin
    .from("generation_runs")
    .insert({ run_date: today, subject, status: "pending" })
    .select("id")
    .single();
  const runId = (runRow as { id: string } | null)?.id;

  try {
    const { count: existingCount } = await admin
      .from("daily_tasks")
      .select("id", { count: "exact", head: true })
      .eq("task_date", today)
      .eq("subject", subject);

    if ((existingCount ?? 0) > 0) {
      await finishRun(admin, runId, "success", existingCount ?? 0);
      return { skipped: "already_generated", count: existingCount };
    }

    const { data: settings } = await admin
      .from("subject_settings")
      .select("daily_format, problems_per_day, enabled")
      .eq("subject", subject)
      .single();

    if (!settings || !settings.enabled) {
      await finishRun(admin, runId, "success", 0);
      return { skipped: "disabled" };
    }

    const { data: overrideRow } = await admin
      .from("generation_overrides")
      .select("id, unit_id, difficulty")
      .eq("subject", subject)
      .eq("consumed", false)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    const override: GenerationOverrideRow | null = overrideRow;

    const { data: unitsData } = await admin
      .from("curriculum_units")
      .select("id, code, name_ja")
      .eq("subject", subject);
    const units: CurriculumUnitRow[] = unitsData ?? [];

    const unitIds = units.map((u) => u.id);
    const { data: masteryData } = await admin
      .from("user_topic_mastery")
      .select("unit_id, mastery_score, current_difficulty")
      .in("unit_id", unitIds.length > 0 ? unitIds : [NIL_UUID]);
    const masteryRows: MasteryRow[] = masteryData ?? [];

    const count = settings.daily_format === "single_large" ? 1 : settings.problems_per_day;

    const plannedTasks = planDailyTasks({
      subject,
      dailyFormat: settings.daily_format,
      count,
      override,
      units,
      masteryRows,
    });

    // 1件ずつ生成する（数学は最大5件）。途中の1件がレート制限等で失敗しても
    // 残りは続行し、生成できた分だけ保存する。
    let generatedCount = 0;
    let lastError: string | null = null;
    for (const planned of plannedTasks) {
      try {
        const problem = await generateProblem({
          subject,
          unitNameJa: planned.unitNameJa,
          difficulty: planned.difficulty,
          problemType: planned.problemType,
          questionCount: planned.questionCount,
        });

        const { error: insertError } = await admin.from("daily_tasks").insert({
          task_date: today,
          subject,
          unit_id: planned.unitId,
          difficulty: planned.difficulty,
          problem_type: problem.problem_type,
          problem_statement: problem.problem_statement,
          choices: problem.choices ?? null,
          model_answer: problem.model_answer,
          solution_steps: problem.solution_steps,
          estimated_minutes: problem.estimated_minutes,
          generation_model: problem.generationModel,
          generation_metadata: {
            selection: override?.unit_id ? "override" : "weighted",
            override_id: override?.id ?? null,
          },
        });

        if (insertError) {
          throw new Error(`daily_tasks insert failed: ${insertError.message}`);
        }
        generatedCount++;
      } catch (itemError) {
        lastError = itemError instanceof Error ? itemError.message : String(itemError);
        console.error(`generateProblem failed for unit ${planned.unitId}`, itemError);
      }
    }

    if (override) {
      await admin.from("generation_overrides").update({ consumed: true }).eq("id", override.id);
    }

    const status = generatedCount > 0 || plannedTasks.length === 0 ? "success" : "error";
    await finishRun(admin, runId, status, generatedCount, lastError ?? undefined);
    return { generated: generatedCount, total: plannedTasks.length, lastError };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishRun(admin, runId, "error", 0, message);
    return { error: message };
  }
}

async function finishRun(
  admin: AdminClient,
  runId: string | undefined,
  status: "success" | "error",
  problemsGenerated: number,
  errorMessage?: string,
) {
  if (!runId) return;
  await admin
    .from("generation_runs")
    .update({
      status,
      problems_generated: problemsGenerated,
      error_message: errorMessage ?? null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}
