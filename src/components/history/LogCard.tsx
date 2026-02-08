'use client';

import { Clock, Layers, TrendingUp } from 'lucide-react';
import { formatDuration, formatWeight } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import type { WorkoutLog } from '@/types/workout';

interface LogCardProps {
  log: WorkoutLog;
  onClick: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatLogDate(isoString: string): string {
  return dateFormatter.format(new Date(isoString));
}

/**
 * A card displaying a workout log entry in the history list.
 * Shows template name, date, duration, set count, and volume.
 */
export const LogCard = ({ log, onClick }: LogCardProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className="mb-3 cursor-pointer rounded-2xl border border-border bg-surface p-4 transition-transform active:scale-[0.98]"
    >
      {/* Header: name + status badge */}
      <div className="flex items-center justify-between">
        <h3 className="truncate pr-2 text-base font-semibold text-white">
          {log.templateName}
        </h3>
        {log.status === 'partial' ? (
          <span className="shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            Partial
          </span>
        ) : null}
      </div>

      {/* Date line */}
      <p className="mt-3 text-xs text-text-muted">
        {formatLogDate(log.startedAt)}
      </p>

      {/* Stats row */}
      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1 text-[13px] text-text-secondary">
          <Clock className="h-3.5 w-3.5 text-text-muted" />
          {formatDuration(log.durationSec)}
        </span>
        <span className="flex items-center gap-1 text-[13px] text-text-secondary">
          <Layers className="h-3.5 w-3.5 text-text-muted" />
          {log.performedSets.length} sets
        </span>
        <span className="flex items-center gap-1 text-[13px] text-text-secondary">
          <TrendingUp className="h-3.5 w-3.5 text-accent" />
          {formatWeight(log.totalVolumeG, unitSystem)}
        </span>
      </div>
    </div>
  );
};
