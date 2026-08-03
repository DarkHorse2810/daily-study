"use client";

import Link from "next/link";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/dashboard" className="text-sm text-blue-600 underline">
        ← ホームに戻る
      </Link>
      <div className="mt-6 rounded border bg-red-50 p-4">
        <p className="font-medium text-red-800">エラーが発生しました</p>
        <p className="mt-2 text-sm text-red-700">{error.message || "不明なエラーです。"}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
        >
          もう一度試す
        </button>
      </div>
    </main>
  );
}
