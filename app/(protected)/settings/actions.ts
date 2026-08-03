"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** 数学の単元ごとの自動出題対象（enabled）をチェックボックスの選択状態に合わせて更新する。 */
export async function updateMathUnitSettings(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const checkedIds = formData.getAll("unit_ids").map(String);
  if (checkedIds.length === 0) {
    throw new Error("少なくとも1つの単元を選択してください");
  }

  const admin = createAdminClient();
  const { data: mathUnits, error: fetchError } = await admin
    .from("curriculum_units")
    .select("id")
    .eq("subject", "math");
  if (fetchError || !mathUnits) {
    throw new Error(`単元一覧の取得に失敗しました: ${fetchError?.message}`);
  }

  const checkedSet = new Set(checkedIds);
  const uncheckedIds = mathUnits.map((u) => u.id).filter((id) => !checkedSet.has(id));

  const { error: enableError } = await admin
    .from("curriculum_units")
    .update({ enabled: true })
    .in("id", checkedIds);
  if (enableError) {
    throw new Error(`設定の保存に失敗しました: ${enableError.message}`);
  }

  if (uncheckedIds.length > 0) {
    const { error: disableError } = await admin
      .from("curriculum_units")
      .update({ enabled: false })
      .in("id", uncheckedIds);
    if (disableError) {
      throw new Error(`設定の保存に失敗しました: ${disableError.message}`);
    }
  }

  revalidatePath("/settings");
  redirect("/settings?saved=1");
}

interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** ブラウザのPush購読情報を保存する（端末ごとに1行、endpointで重複を防ぐ）。 */
export async function savePushSubscription(subscription: PushSubscriptionInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("ログインが必要です");
  }

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) {
    throw new Error(`通知の登録に失敗しました: ${error.message}`);
  }
}

/** この端末の通知登録を解除する。 */
export async function deletePushSubscription(endpoint: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("ログインが必要です");
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint)
    .eq("user_id", user.id);
  if (error) {
    throw new Error(`通知の解除に失敗しました: ${error.message}`);
  }
}
