"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeSubmission } from "@/lib/gemini/gradeSubmission";
import { transcribeAnswerImage } from "@/lib/gemini/transcribeAnswerImage";
import { applyMasteryUpdate } from "@/lib/study/mastery";
import { APP_TIMEZONE, GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Subject } from "@/lib/curriculum";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

interface GradeAndScoreParams {
  submissionId: string;
  userId: string;
  subject: Subject;
  unitId: string;
  problemStatement: string;
  modelAnswer: string;
  studentAnswer: string;
}

/**
 * 添削を実行しreviews/user_topic_masteryへ反映する。
 * ここでの失敗は握りつぶし、呼び出し元は必ずリダイレクトする
 * （提出済み・review未作成の状態としてページ側の「採点中」表示＋再試行ボタンに任せる）。
 */
async function gradeAndScore(params: GradeAndScoreParams): Promise<void> {
  const admin = createAdminClient();

  const review = await gradeSubmission({
    subject: params.subject,
    problemStatement: params.problemStatement,
    modelAnswer: params.modelAnswer,
    studentAnswer: params.studentAnswer,
  });

  const { error: reviewError } = await admin.from("reviews").insert({
    submission_id: params.submissionId,
    is_correct: review.is_correct,
    score: review.score,
    feedback: review.feedback,
    strengths: review.strengths ?? null,
    improvement_points: review.improvement_points ?? null,
    corrected_answer: review.corrected_answer ?? null,
    grading_model: GEMINI_MODEL_STRONG,
  });
  if (reviewError) {
    throw new Error(`添削結果の保存に失敗しました: ${reviewError.message}`);
  }

  await applyMasteryUpdate({ userId: params.userId, unitId: params.unitId, review });
}

/**
 * 解答テキストを解決する。写真が添付されている場合は、その写真をそのまま解答として
 * 提出できるようにGeminiで文字起こしする（提出後に「あなたの解答」として表示されるため、
 * 生徒はそこで読み取り内容を確認できる）。写真が無ければ入力されたテキストをそのまま使う。
 */
async function resolveAnswerText(formData: FormData): Promise<string> {
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > MAX_PHOTO_BYTES) {
      throw new Error("写真のサイズが大きすぎます（10MBまで）");
    }
    const arrayBuffer = await photo.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = photo.type || "image/jpeg";
    const transcribed = (await transcribeAnswerImage({ base64, mimeType })).trim();
    if (!transcribed) {
      throw new Error("写真から解答を読み取れませんでした。文字がはっきり写るように撮り直してください。");
    }
    return transcribed;
  }

  const answerText = String(formData.get("answer") ?? "").trim();
  if (!answerText) {
    throw new Error("解答を入力するか、写真を選択してください");
  }
  return answerText;
}

export async function submitAnswer(taskId: string, formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: task, error: taskError } = await supabase
    .from("daily_tasks")
    .select("task_date, subject, unit_id, problem_statement, model_answer")
    .eq("id", taskId)
    .single();
  if (taskError || !task) {
    throw new Error("課題が見つかりません");
  }

  const today = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  if (task.task_date !== today) {
    throw new Error("この課題は本日分ではないため、解答の受付を終了しています");
  }

  const answerText = await resolveAnswerText(formData);

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({ task_id: taskId, user_id: user.id, answer_text: answerText })
    .select("id")
    .single();
  if (submissionError || !submission) {
    throw new Error(`解答の提出に失敗しました: ${submissionError?.message}`);
  }

  try {
    await gradeAndScore({
      submissionId: submission.id,
      userId: user.id,
      subject: task.subject,
      unitId: task.unit_id,
      problemStatement: task.problem_statement,
      modelAnswer: task.model_answer,
      studentAnswer: answerText,
    });
  } catch (err) {
    console.error("grading failed after submission", err);
  }

  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function retryGrading(submissionId: string): Promise<void> {
  const admin = createAdminClient();

  const { data: submissionData, error } = await admin
    .from("submissions")
    .select("id, task_id, user_id, answer_text, daily_tasks(subject, unit_id, problem_statement, model_answer)")
    .eq("id", submissionId)
    .single();
  if (error || !submissionData) {
    throw new Error("提出が見つかりません");
  }

  const task = Array.isArray(submissionData.daily_tasks)
    ? submissionData.daily_tasks[0]
    : submissionData.daily_tasks;
  if (!task) {
    throw new Error("紐づく課題が見つかりません");
  }

  try {
    await gradeAndScore({
      submissionId: submissionData.id,
      userId: submissionData.user_id,
      subject: task.subject,
      unitId: task.unit_id,
      problemStatement: task.problem_statement,
      modelAnswer: task.model_answer,
      studentAnswer: submissionData.answer_text,
    });
  } catch (err) {
    console.error("retry grading failed", err);
  }

  revalidatePath(`/tasks/${submissionData.task_id}`);
  redirect(`/tasks/${submissionData.task_id}`);
}
