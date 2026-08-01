import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  format,
  addMonths,
  subMonths,
} from "date-fns";

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export function CalendarMonth({
  monthStr,
  todayStr,
  datesWithTasks,
}: {
  /** "yyyy-MM" */
  monthStr: string;
  /** "yyyy-MM-dd" */
  todayStr: string;
  datesWithTasks: Set<string>;
}) {
  const monthStart = startOfMonth(new Date(`${monthStr}-01T00:00:00`));
  const monthEnd = endOfMonth(monthStart);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

  const prevMonth = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");

  return (
    <section className="mt-10 border-t pt-6">
      <div className="flex items-center justify-between">
        <Link href={`/dashboard?month=${prevMonth}`} className="text-sm text-blue-600 underline">
          ← 前月
        </Link>
        <h2 className="text-sm font-medium text-gray-700">{format(monthStart, "yyyy年M月")}</h2>
        <Link href={`/dashboard?month=${nextMonth}`} className="text-sm text-blue-600 underline">
          翌月 →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-sm">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="py-1 text-xs text-gray-400">
            {w}
          </div>
        ))}
        {Array.from({ length: leadingBlanks }).map((_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const hasTasks = datesWithTasks.has(dateStr);
          const isToday = dateStr === todayStr;
          const isFuture = dateStr > todayStr;

          if (isFuture) {
            return (
              <div key={dateStr} className="rounded py-2 text-gray-300">
                {day.getDate()}
              </div>
            );
          }

          return (
            <Link
              key={dateStr}
              href={`/history/${dateStr}`}
              className={`rounded py-2 hover:bg-blue-50 ${
                isToday ? "bg-blue-100 font-semibold" : ""
              } ${hasTasks ? "text-gray-900" : "text-gray-400"}`}
            >
              <span>{day.getDate()}</span>
              {hasTasks && (
                <span className="mx-auto mt-0.5 block h-1 w-1 rounded-full bg-blue-500" />
              )}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        日付をクリックすると、その日の取り組み状況と解答・添削内容を確認できます。
      </p>
    </section>
  );
}
