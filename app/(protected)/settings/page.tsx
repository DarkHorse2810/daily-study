import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VAPID_PUBLIC_KEY } from "@/lib/config";
import { PushNotificationToggle } from "@/lib/components/PushNotificationToggle";
import { updateMathUnitSettings } from "./actions";

interface MathUnitRow {
  id: string;
  name_ja: string;
  enabled: boolean;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const { data: units } = await supabase
    .from("curriculum_units")
    .select("id, name_ja, enabled")
    .eq("subject", "math")
    .order("sort_order", { ascending: true });
  const mathUnits: MathUnitRow[] = units ?? [];

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-blue-600 underline">
        ← ホームに戻る
      </Link>
      <h1 className="mt-4 text-xl font-semibold">設定</h1>
      <p className="mt-2 text-sm text-gray-600">
        チェックを外した単元は、数学の日次課題の自動出題対象から除外されます（考査直前の単元指定機能には影響しません）。少なくとも1つは選択してください。
      </p>
      {saved && <p className="mt-2 text-sm text-green-600">保存しました。</p>}

      <form action={updateMathUnitSettings} className="mt-6 space-y-2">
        {mathUnits.map((unit) => (
          <label key={unit.id} className="flex items-center gap-2">
            <input type="checkbox" name="unit_ids" value={unit.id} defaultChecked={unit.enabled} />
            {unit.name_ja}
          </label>
        ))}
        <button
          type="submit"
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          保存する
        </button>
      </form>

      <PushNotificationToggle vapidPublicKey={VAPID_PUBLIC_KEY} />
    </main>
  );
}
