"use client";

import { useRef, useState } from "react";
import type { ProblemType } from "@/lib/curriculum";
import { submitAnswer } from "./actions";

interface AnswerFormProps {
  taskId: string;
  problemType: ProblemType;
  choices: string[] | null;
}

export function AnswerForm({ taskId, problemType, choices }: AnswerFormProps) {
  const [answer, setAnswer] = useState("");
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(file ? URL.createObjectURL(file) : null);
  }

  function clearPhoto() {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setPhotoPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit = answer.trim().length > 0 || photoPreviewUrl !== null;

  return (
    <form action={submitAnswer.bind(null, taskId)} className="mt-6 space-y-4">
      {problemType === "multiple_choice" && choices ? (
        <div className="space-y-2">
          {choices.map((choice, i) => (
            <label key={i} className="flex items-center gap-2">
              <input type="radio" name="answer" value={choice} required />
              {choice}
            </label>
          ))}
        </div>
      ) : (
        <>
          <textarea
            name="answer"
            rows={8}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full rounded border p-3"
            placeholder="ここに解答を入力するか、下のボタンで紙に書いた解答の写真を選択してください"
          />
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-4 py-2 text-sm hover:bg-gray-50">
              写真を選択
              <input
                ref={fileInputRef}
                type="file"
                name="photo"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
              />
            </label>
            <p className="mt-1 text-xs text-gray-500">
              写真を選択すると、その写真の内容がそのまま解答として提出されます（提出後、AIが読み取った内容を「あなたの解答」欄で確認できます）。
            </p>
            {photoPreviewUrl && (
              <div className="mt-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoPreviewUrl} alt="選択した写真" className="max-h-48 rounded border" />
                <button
                  type="button"
                  onClick={clearPhoto}
                  className="mt-1 block text-xs text-red-600 underline"
                >
                  写真を取り消す
                </button>
              </div>
            )}
          </div>
        </>
      )}
      <button
        type="submit"
        disabled={problemType !== "multiple_choice" && !canSubmit}
        className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 active:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        提出する
      </button>
    </form>
  );
}
