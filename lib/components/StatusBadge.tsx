import type { TaskStatus } from "@/lib/study/dayView";

export function StatusBadge({ status, score }: { status: TaskStatus; score?: number }) {
  if (status === "graded") {
    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-800">
        {score}点
      </span>
    );
  }
  if (status === "grading") {
    return (
      <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm text-yellow-800">
        採点中
      </span>
    );
  }
  return <span className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-600">未回答</span>;
}
