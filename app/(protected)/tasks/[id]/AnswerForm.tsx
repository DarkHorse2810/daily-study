"use client";

import { useRef, useState, useTransition } from "react";
import type { ProblemType } from "@/lib/curriculum";
import { submitAnswer, transcribePhoto } from "./actions";

interface AnswerFormProps {
  taskId: string;
  problemType: ProblemType;
  choices: string[] | null;
}

export function AnswerForm({ taskId, problemType, choices }: AnswerFormProps) {
  const [answer, setAnswer] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isTranscribing, startTranscribing] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);

    const photoFormData = new FormData();
    photoFormData.append("photo", file);

    startTranscribing(async () => {
      try {
        const transcribed = await transcribePhoto(photoFormData);
        setAnswer((prev) => (prev.trim() ? `${prev}\n${transcribed}` : transcribed));
      } catch (err) {
        setPhotoError(err instanceof Error ? err.message : "写真の読み込みに失敗しました");
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    });
  }

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
            required
            rows={8}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            className="w-full rounded border p-3"
            placeholder="ここに解答を入力するか、下のボタンで紙に書いた解答の写真から読み込んでください"
          />
          <div>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded border px-4 py-2 text-sm hover:bg-gray-50">
              {isTranscribing ? "写真を読み込み中…" : "写真から読み込む"}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoChange}
                disabled={isTranscribing}
              />
            </label>
            <p className="mt-1 text-xs text-gray-500">
              読み込んだ内容は解答欄に追記されます。提出前に内容を確認・修正してください。
            </p>
            {photoError && <p className="mt-1 text-sm text-red-600">{photoError}</p>}
          </div>
        </>
      )}
      <button
        type="submit"
        className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        提出する
      </button>
    </form>
  );
}
