import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { VAPID_PUBLIC_KEY } from "@/lib/config";
import { PushNotificationToggle } from "@/lib/components/PushNotificationToggle";
import { updateMathUnitSettings, updateMathDifficultySettings } from "./actions";

interface MathUnitRow {
  id: string;
  name_ja: string;
  enabled: boolean;
}

const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const [{ data: units }, { data: mathSettings }] = await Promise.all([
    supabase
      .from("curriculum_units")
      .select("id, name_ja, enabled")
      .eq("subject", "math")
      .order("sort_order", { ascending: true }),
    supabase
      .from("subject_settings")
      .select("problems_per_day, difficulty_distribution")
      .eq("subject", "math")
      .single(),
  ]);
  const mathUnits: MathUnitRow[] = units ?? [];
  const problemsPerDay = mathSettings?.problems_per_day ?? 5;
  const difficultyDistribution = (mathSettings?.difficulty_distribution ?? null) as Record<
    string,
    number
  > | null;
  const isAutoDifficulty = !difficultyDistribution;

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
          className="mt-4 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 active:bg-blue-900"
        >
          保存する
        </button>
      </form>

      <section className="mt-8 border-t pt-6">
        <h2 className="text-lg font-semibold">数学の難易度配分</h2>
        <p className="mt-2 text-sm text-gray-600">
          1日{problemsPerDay}問のうち、難易度（★の数）ごとの出題数を指定できます。「自動」を選ぶと、従来通り習熟度に応じて自動調整されます。手動指定する場合は、合計が{problemsPerDay}問になるようにしてください。
        </p>
        <form action={updateMathDifficultySettings} className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="auto" defaultChecked={isAutoDifficulty} />
            自動（習熟度に応じて調整する）
          </label>
          <div className="flex flex-wrap gap-3">
            {DIFFICULTY_LEVELS.map((level) => (
              <label key={level} className="flex flex-col items-center text-sm">
                <span>{"★".repeat(level)}</span>
                <input
                  type="number"
                  name={`difficulty_${level}`}
                  min={0}
                  defaultValue={difficultyDistribution?.[String(level)] ?? 0}
                  className="mt-1 w-16 rounded border p-1 text-center"
                />
              </label>
            ))}
          </div>
          <button
            type="submit"
            className="mt-2 rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 active:bg-blue-900"
          >
            保存する
          </button>
        </form>
      </section>

      <PushNotificationToggle vapidPublicKey={VAPID_PUBLIC_KEY} />
    </main>
  );
}
