import { DIFFICULTY_LABELS, type Difficulty } from "@/lib/curriculum";

/** 難易度を★の5段階表示にし、判定基準の文言も併記する。 */
export function DifficultyStars({ difficulty }: { difficulty: Difficulty }) {
  const stars = "★".repeat(difficulty) + "☆".repeat(5 - difficulty);
  return (
    <span>
      <span aria-label={`難易度${difficulty}/5`} className="tracking-wide text-amber-500">
        {stars}
      </span>
      <span className="ml-1 text-gray-500">（{DIFFICULTY_LABELS[difficulty]}）</span>
    </span>
  );
}
