"use client";

import { useMemo, useState } from "react";

interface SubItem {
  number: number;
  question_text: string;
  choices: string[];
}

const ZENKAKU_DIGITS = "０１２３４５６７８９";
const CIRCLED_NUMBERS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨"];

function toZenkakuNumber(n: number): string {
  return String(n)
    .split("")
    .map((d) => ZENKAKU_DIGITS[Number(d)])
    .join("");
}

/**
 * 単語・文法ドリル等、1課題に複数の選択式小問がまとまっている場合の解答フォーム。
 * 各小問の選択肢をボタンとして表示し、押したものがそのまま解答になる。
 */
export function BundledChoiceForm({
  taskId,
  subItems,
  submitAction,
}: {
  taskId: string;
  subItems: SubItem[];
  submitAction: (taskId: string, formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Record<number, number>>({});
  const allAnswered = subItems.every((item) => selected[item.number] !== undefined);

  const answerText = useMemo(
    () =>
      subItems
        .map((item) => {
          const choiceIndex = selected[item.number];
          if (choiceIndex === undefined) {
            return `（${toZenkakuNumber(item.number)}）未回答`;
          }
          const circled = CIRCLED_NUMBERS[choiceIndex] ?? `${choiceIndex + 1}`;
          return `（${toZenkakuNumber(item.number)}）${circled} ${item.choices[choiceIndex]}`;
        })
        .join("\n\n"),
    [subItems, selected],
  );

  return (
    <form action={submitAction.bind(null, taskId)} className="mt-6 space-y-6">
      <input type="hidden" name="answer" value={answerText} />
      {subItems.map((item) => (
        <div key={item.number} className="rounded border bg-gray-50 p-4">
          <p className="whitespace-pre-wrap font-medium">
            （{toZenkakuNumber(item.number)}）{item.question_text}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.choices.map((choice, idx) => {
              const isSelected = selected[item.number] === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() =>
                    setSelected((prev) => ({ ...prev, [item.number]: idx }))
                  }
                  className={`rounded border px-3 py-2 text-sm ${
                    isSelected
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-gray-300 bg-white hover:bg-gray-100"
                  }`}
                >
                  {CIRCLED_NUMBERS[idx] ?? idx + 1} {choice}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <button
        type="submit"
        disabled={!allAnswered}
        className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 active:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {allAnswered ? "提出する" : `あと${subItems.length - Object.keys(selected).length}問`}
      </button>
    </form>
  );
}
