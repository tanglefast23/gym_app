'use client';

import { Clock, Dumbbell, Layers, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { formatDuration, formatWeight } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import type { WorkoutLog } from '@/types/workout';

interface LogCardProps {
  log: WorkoutLog;
  onClick: () => void;
}

/**
 * Formats a date string into a human-readable display like "Feb 8, 2026".
 */
function formatLogDate(isoString: string): string {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/**
 * Extracts unique exercise names from performed sets.
 * Returns at most `limit` names, with a count of remaining.
 */
function summarizeExercises(
  sets: WorkoutLog['performedSets'],
  limit: number,
): { names: string[]; remaining: number } {
  const seen = new Set<string>();
  const names: string[] = [];

  for (const set of sets) {
    if (seen.has(set.exerciseId)) continue;
    seen.add(set.exerciseId);
    names.push(set.exerciseNameSnapshot);
  }

  return {
    names: names.slice(0, limit),
    remaining: Math.max(0, names.length - limit),
  };
}

/**
 * A card displaying a workout log entry in the history list.
 * Shows template name, date, duration, set count, volume, and exercise summary.
 */
export const LogCard = ({ log, onClick }: LogCardProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const { names, remaining } = summarizeExercises(log.performedSets, 3);

  return (
    <Card onClick={onClick} className="mb-3">
      {/* Top row: name + status badge */}
      <div className="flex items-center justify-between">
        <h3 className="truncate pr-2 font-semibold text-text-primary">
          {log.templateName}
        </h3>
        {log.status === 'partial' ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            Partial
          </span>
        ) : null}
      </div>

      {/* Date */}
      <p className="mt-1 text-xs text-text-muted">
        {formatLogDate(log.startedAt)}
      </p>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-text-muted" />
          {formatDuration(log.durationSec)}
        </span>
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5 text-text-muted" />
          {log.performedSets.length} sets
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="h-3.5 w-3.5 text-text-muted" />
          {formatWeight(log.totalVolumeG, unitSystem)}
        </span>
      </div>

      {/* Exercise summary */}
      <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
        <Dumbbell className="h-3 w-3 shrink-0" />
        <span className="truncate">
          {names.join(', ')}
          {remaining > 0 ? ` +${remaining} more` : ''}
        </span>
      </div>
    </Card>
  );
};
