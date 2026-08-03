"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gradeSubmission } from "@/lib/gemini/gradeSubmission";
import { applyMasteryUpdate } from "@/lib/study/mastery";
import { APP_TIMEZONE, GEMINI_MODEL_STRONG } from "@/lib/config";
import type { Review } from "@/lib/gemini/schemas/review";
import type { Subject } from "@/lib/curriculum";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // 10MB

interface PersistReviewParams {
  submissionId: string;
  userId: string;
  unitId: string;
  review: Review;
}

/** 添削結果をreviews/user_topic_masteryへ反映する（Gemini呼び出しは既に完了している前提）。 */
async function persistReview(params: PersistReviewParams): Promise<void> {
  const admin = createAdminClient();

  const { error: reviewError } = await admin.from("reviews").insert({
    submission_id: params.submissionId,
    is_correct: params.review.is_correct,
    score: params.review.score,
    feedback: params.review.feedback,
    strengths: params.review.strengths ?? null,
    improvement_points: params.review.improvement_points ?? null,
    corrected_answer: params.review.corrected_answer ?? null,
    grading_model: GEMINI_MODEL_STRONG,
  });
  if (reviewError) {
    throw new Error(`添削結果の保存に失敗しました: ${reviewError.message}`);
  }

  await applyMasteryUpdate({ userId: params.userId, unitId: params.unitId, review: params.review });
}

interface GradeAndScoreParams {
  submissionId: string;
  userId: string;
  subject: Subject;
  unitId: string;
  problemStatement: string;
  modelAnswer: string;
  studentAnswer: string;
}

/** テキスト解答を添削し、reviews/user_topic_masteryへ反映する（Gemini呼び出しを1回行う）。 */
async function gradeAndScore(params: GradeAndScoreParams): Promise<void> {
  const review = await gradeSubmission({
    subject: params.subject,
    problemStatement: params.problemStatement,
    modelAnswer: params.modelAnswer,
    studentAnswer: params.studentAnswer,
  });
  await persistReview({
    submissionId: params.submissionId,
    userId: params.userId,
    unitId: params.unitId,
    review,
  });
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

  const photo = formData.get("photo");
  const hasPhoto = photo instanceof File && photo.size > 0;

  let answerText: string;
  let photoReview: Review | null = null;

  if (hasPhoto) {
    if ((photo as File).size > MAX_PHOTO_BYTES) {
      throw new Error("写真のサイズが大きすぎます（10MBまで）");
    }
    const arrayBuffer = await (photo as File).arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = (photo as File).type || "image/jpeg";

    // 写真提出は「文字起こし→添削」を1回のGemini呼び出しでまとめて行う
    // （2回に分けると時間がかかりすぎるため）。ここで失敗した場合は解答自体が
    // 提出できないため、そのままエラーを投げてerror.tsxで再試行を促す。
    photoReview = await gradeSubmission({
      subject: task.subject,
      problemStatement: task.problem_statement,
      modelAnswer: task.model_answer,
      studentAnswerImage: { base64, mimeType },
    });
    answerText = photoReview.transcribed_answer?.trim() || "";
    if (!answerText) {
      throw new Error("写真から解答を読み取れませんでした。文字がはっきり写るように撮り直してください。");
    }
  } else {
    answerText = String(formData.get("answer") ?? "").trim();
    if (!answerText) {
      throw new Error("解答を入力するか、写真を選択してください");
    }
  }

  const { data: submission, error: submissionError } = await supabase
    .from("submissions")
    .insert({ task_id: taskId, user_id: user.id, answer_text: answerText })
    .select("id")
    .single();
  if (submissionError || !submission) {
    throw new Error(`解答の提出に失敗しました: ${submissionError?.message}`);
  }

  try {
    if (photoReview) {
      await persistReview({
        submissionId: submission.id,
        userId: user.id,
        unitId: task.unit_id,
        review: photoReview,
      });
    } else {
      await gradeAndScore({
        submissionId: submission.id,
        userId: user.id,
        subject: task.subject,
        unitId: task.unit_id,
        problemStatement: task.problem_statement,
        modelAnswer: task.model_answer,
        studentAnswer: answerText,
      });
    }
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
