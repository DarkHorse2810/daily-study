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
