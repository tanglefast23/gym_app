'use client';

import { Clock, Dumbbell, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';

import type { WorkoutTemplate, TemplateBlock } from '@/types/workout';

interface WorkoutCardProps {
  template: WorkoutTemplate;
  lastPerformed?: string | null;
  onClick: () => void;
}

/**
 * Card displayed on the home page for each workout template.
 *
 * Shows the template name, exercise count, estimated duration,
 * and when the workout was last performed.
 */
export const WorkoutCard = ({
  template,
  lastPerformed,
  onClick,
}: WorkoutCardProps) => {
  const exerciseCount = countExercises(template.blocks);
  const estimatedDuration = estimateWorkoutDuration(template);
  const lastPerformedLabel = formatLastPerformed(lastPerformed);

  return (
    <Card onClick={onClick} padding="md">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="truncate text-lg font-semibold text-text-primary">
          {template.name}
        </h3>
        <ChevronRight className="h-5 w-5 flex-shrink-0 text-text-muted" />
      </div>

      {/* Meta row */}
      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Dumbbell className="h-4 w-4 text-text-muted" />
          {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
        </span>
        <span className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Clock className="h-4 w-4 text-text-muted" />
          ~{Math.round(estimatedDuration / 60)} min
        </span>
      </div>

      {/* Last performed */}
      <p className="mt-3 text-[13px] text-text-muted">
        {lastPerformedLabel}
      </p>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Count the total number of distinct exercises across all template blocks.
 * A superset contributes the number of exercises it contains.
 */
function countExercises(blocks: TemplateBlock[]): number {
  return blocks.reduce((count, block) => {
    if (block.type === 'exercise') return count + 1;
    return count + block.exercises.length;
  }, 0);
}

/**
 * Estimate total workout duration in seconds.
 *
 * Heuristic: ~2 minutes per set (including exercise time) + rest durations.
 * Rest defaults to template default when not overridden on the block.
 */
function estimateWorkoutDuration(template: WorkoutTemplate): number {
  const SECONDS_PER_SET = 120;
  const defaultRest = template.defaultRestBetweenSetsSec ?? 90;
  let total = 0;

  for (const block of template.blocks) {
    if (block.type === 'exercise') {
      const rest = block.restBetweenSetsSec ?? defaultRest;
      total += block.sets * SECONDS_PER_SET;
      total += Math.max(0, block.sets - 1) * rest;
    } else {
      const exercisesPerRound = block.exercises.length;
      const roundTime =
        exercisesPerRound * SECONDS_PER_SET +
        Math.max(0, exercisesPerRound - 1) * block.restBetweenExercisesSec;
      total += block.sets * roundTime;
      total += Math.max(0, block.sets - 1) * block.restBetweenSupersetsSec;
    }
  }

  return total;
}

/**
 * Format the lastPerformed date into a human-readable label.
 */
function formatLastPerformed(isoDate: string | null | undefined): string {
  if (!isoDate) return 'Never performed';

  try {
    const performed = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - performed.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Last performed: today';
    if (diffDays === 1) return 'Last performed: yesterday';
    return `Last performed: ${diffDays} days ago`;
  } catch {
    return 'Never performed';
  }
}
