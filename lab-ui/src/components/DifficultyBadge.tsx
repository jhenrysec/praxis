import type { Scenario } from '@/types';
import { DIFFICULTY_COLORS } from '@/types';

interface DifficultyBadgeProps {
  difficulty: Scenario['difficulty'];
}

export function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const color = DIFFICULTY_COLORS[difficulty];

  return (
    <span
      className="label-mono inline-flex items-center rounded px-2 py-0.5"
      style={{
        backgroundColor: `${color}1a`,
        color,
        border: `1px solid ${color}33`,
      }}
      aria-label={`Difficulty: ${difficulty}`}
    >
      {difficulty}
    </span>
  );
}
