'use client';

import { Clock, Dumbbell, ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';

import type { WorkoutTemplate, TemplateBlock } from '@/types/workout';

interface WorkoutCardProps {
  template: WorkoutTemplate;
  lastPerformed?: string | null;
  exerciseNameMap?: Map<string, string>;
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
  exerciseNameMap,
  onClick,
}: WorkoutCardProps) => {
  const exerciseCount = countExercises(template.blocks);
  const estimatedDuration = estimateWorkoutDuration(template);
  const lastPerformedLabel = formatLastPerformed(lastPerformed);
  const coverSrc = `/visuals/covers/cover-${pickCoverIndex(template.id)}.svg`;
  const exercisePreview = exerciseNameMap
    ? getExercisePreview(template.blocks, exerciseNameMap)
    : '';

  return (
    <Card onClick={onClick} padding="md">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl bg-elevated object-cover"
            draggable={false}
          />
          <h3 className="truncate text-lg font-semibold text-text-primary">
            {template.name}
          </h3>
        </div>
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

      {/* Exercise preview */}
      {exercisePreview ? (
        <p className="mt-2 truncate text-[13px] text-text-secondary">
          {exercisePreview}
        </p>
      ) : null}

      {/* Last performed */}
      <p className="mt-2 text-[13px] text-text-muted">
        {lastPerformedLabel}
      </p>
    </Card>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first 2–3 exercise names for a card preview line.
 * Appends "+N more" when the template has additional exercises.
 */
function getExercisePreview(
  blocks: TemplateBlock[],
  nameMap: Map<string, string>,
): string {
  const names: string[] = [];
  for (const block of blocks) {
    if (block.type === 'exercise') {
      const name = nameMap.get(block.exerciseId);
      if (name) names.push(name);
    } else {
      for (const ex of block.exercises) {
        const name = nameMap.get(ex.exerciseId);
        if (name) names.push(name);
      }
    }
    if (names.length >= 3) break;
  }

  if (names.length === 0) return '';

  const total = countExercises(blocks);
  const remaining = total - names.length;

  if (remaining > 0) {
    return `${names.join(', ')} +${remaining} more`;
  }
  return names.join(', ');
}

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

function pickCoverIndex(templateId: string): string {
  // Stable pseudo-random cover selection with no new schema fields.
  let hash = 0;
  for (let i = 0; i < templateId.length; i++) {
    hash = (hash * 31 + templateId.charCodeAt(i)) >>> 0;
  }
  const idx = (hash % 4) + 1;
  return String(idx).padStart(2, '0');
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
    const performedMs = performed.getTime();
    if (Number.isNaN(performedMs)) return 'Never performed';

    const now = new Date();
    const diffMs = now.getTime() - performedMs;
    // If the device clock changed or the date is in the future, treat as "today"
    // instead of showing negative/NaN day counts.
    const safeDiffMs = Math.max(0, diffMs);
    const diffDays = Math.floor(safeDiffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Last performed: today';
    if (diffDays === 1) return 'Last performed: yesterday';
    return `Last performed: ${diffDays} days ago`;
  } catch {
    return 'Never performed';
  }
}
