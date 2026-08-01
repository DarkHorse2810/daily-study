import Link from "next/link";
import { DifficultyStars } from "@/lib/components/DifficultyStars";
import { StatusBadge } from "@/lib/components/StatusBadge";
import type { DayTask } from "@/lib/study/dayView";
import type { Difficulty } from "@/lib/curriculum";

export function TaskList({ tasks }: { tasks: DayTask[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {tasks.map((task) => (
        <li key={task.id}>
          <Link
            href={`/tasks/${task.id}`}
            className="flex items-center justify-between rounded border p-4 hover:bg-gray-50"
          >
            <div>
              <p className="font-medium">
                {task.subject === "math" ? "数学" : "英語"}・{task.unitName}
              </p>
              <p className="text-sm text-gray-500">
                難易度: <DifficultyStars difficulty={task.difficulty as Difficulty} />
              </p>
            </div>
            <StatusBadge status={task.status} score={task.score} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
