'use client';

import { Card } from '@/components/ui/Card';

import { hexToRgba } from '@/lib/workoutTypeColors';
import type { WorkoutTemplate, TemplateBlock } from '@/types/workout';

interface WorkoutCardProps {
  template: WorkoutTemplate;
  lastPerformed?: string | null;
  exerciseNameMap?: Map<string, string>;
  typeColor: string;
  /**
   * Optional stable-ish index from the list render to vary visuals across cards.
   * Falls back to a template-id hash when omitted.
   */
  colorIndex?: number;
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
  typeColor,
  colorIndex,
  onClick,
}: WorkoutCardProps) => {
  const exerciseIds = getDistinctExerciseIds(template.blocks);
  const exerciseCount = exerciseIds.length;
  const lastPerformedLabel = formatLastPerformed(lastPerformed);
  const coverSrc = `/visuals/covers/cover-${pickCoverIndex(template.id, colorIndex)}.svg`;
  const exerciseNames = exerciseNameMap
    ? getExerciseNamesList(exerciseIds, exerciseNameMap)
    : [];

  return (
    <Card
      onClick={onClick}
      padding="md"
      style={{
        // Match History card styling: surface base with a pastel wash + colored border.
        backgroundImage: `linear-gradient(0deg, ${hexToRgba(typeColor, 0.18)}, ${hexToRgba(typeColor, 0.18)})`,
        borderColor: hexToRgba(typeColor, 0.55),
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverSrc}
            alt=""
            className="card-cover h-11 w-11 shrink-0 rounded-xl bg-elevated object-cover"
            draggable={false}
          />
          <h3 className="truncate text-lg font-semibold text-text-primary">
            {template.name}
          </h3>
        </div>
        <span
          className="exercise-count rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            backgroundColor: hexToRgba(typeColor, 0.22),
          }}
        >
          {exerciseCount} {exerciseCount === 1 ? 'exercise' : 'exercises'}
        </span>
      </div>

      {/* Exercise preview pills */}
      {exerciseNames.length > 0 ? (
        <div
          className="exercise-pills mt-3 flex flex-wrap gap-2"
          role="region"
          aria-label="Exercises in workout"
        >
          {exerciseNames.map(({ id, name }) => (
            <span
              key={id}
              className="exercise-tag rounded-full bg-elevated px-2.5 py-0.5 text-xs text-text-secondary"
            >
              {name}
            </span>
          ))}
        </div>
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
 * Extract distinct exercise IDs in order of appearance.
 */
function getDistinctExerciseIds(
  blocks: TemplateBlock[],
): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];

  for (const block of blocks) {
    if (block.type === 'exercise') {
      if (!block.exerciseId) continue;
      if (seen.has(block.exerciseId)) continue;
      seen.add(block.exerciseId);
      ids.push(block.exerciseId);
    } else {
      for (const ex of block.exercises) {
        if (!ex.exerciseId) continue;
        if (seen.has(ex.exerciseId)) continue;
        seen.add(ex.exerciseId);
        ids.push(ex.exerciseId);
      }
    }
  }

  return ids;
}

function getExerciseNamesList(
  exerciseIds: string[],
  nameMap: Map<string, string>,
): Array<{ id: string; name: string }> {
  const names: Array<{ id: string; name: string }> = [];
  for (const id of exerciseIds) {
    const name = nameMap.get(id);
    if (name) names.push({ id, name });
  }
  return names;
}

function pickCoverIndex(
  templateId: string,
  colorIndex?: number,
): string {
  // Prefer a list index when provided (nice visual variety when browsing),
  // otherwise fall back to a stable template-id hash.
  const base =
    typeof colorIndex === 'number' && Number.isFinite(colorIndex)
      ? colorIndex
      : (() => {
          let hash = 0;
          for (let i = 0; i < templateId.length; i++) {
            hash = (hash * 31 + templateId.charCodeAt(i)) >>> 0;
          }
          return hash;
        })();

  const idx = (Math.abs(base) % 4) + 1;
  return String(idx).padStart(2, '0');
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
