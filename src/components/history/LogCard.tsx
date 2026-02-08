'use client';

import { useRef, useCallback } from 'react';
import { Clock, Layers, TrendingUp } from 'lucide-react';
import { formatDuration, formatWeight } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import type { WorkoutLog } from '@/types/workout';

interface LogCardProps {
  log: WorkoutLog;
  onClick: () => void;
  onLongPress?: () => void;
}

const LONG_PRESS_MS = 500;

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
export const LogCard = ({ log, onClick, onLongPress }: LogCardProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startPress = useCallback(() => {
    didLongPress.current = false;
    timerRef.current = setTimeout(() => {
      didLongPress.current = true;
      onLongPress?.();
    }, LONG_PRESS_MS);
  }, [onLongPress]);

  const handleClick = useCallback(() => {
    if (didLongPress.current) return;
    onClick();
  }, [onClick]);

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onTouchStart={startPress}
      onTouchEnd={clearTimer}
      onTouchCancel={clearTimer}
      onMouseDown={startPress}
      onMouseUp={clearTimer}
      onMouseLeave={clearTimer}
      onContextMenu={(e) => {
        if (onLongPress) e.preventDefault();
      }}
      className="mb-3 cursor-pointer rounded-2xl border border-border bg-surface p-4 transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
          <Clock className="h-4 w-4 text-text-muted" />
          {formatDuration(log.durationSec)}
        </span>
        <span className="flex items-center gap-1 text-[13px] text-text-secondary">
          <Layers className="h-4 w-4 text-text-muted" />
          {log.performedSets.length} sets
        </span>
        <span className="flex items-center gap-1 text-[13px] text-text-secondary">
          <TrendingUp className="h-4 w-4 text-accent" />
          {formatWeight(log.totalVolumeG, unitSystem)}
        </span>
      </div>
    </div>
  );
};
