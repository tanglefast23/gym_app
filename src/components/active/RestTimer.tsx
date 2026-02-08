'use client';

import { Minus, Plus, SkipForward } from 'lucide-react';
import { TimerRing } from './TimerRing';

interface NextUpInfo {
  exerciseName: string;
  setNumber?: number;
  totalSets?: number;
  repsMin?: number;
  repsMax?: number;
}

interface RestTimerProps {
  remainingMs: number;
  totalMs: number;
  isSuperset?: boolean;
  nextUpLabel?: string;
  nextUpInfo?: NextUpInfo;
  onSkip: () => void;
  onAdjust: (seconds: number) => void;
}

/**
 * Parses a "Next: Exercise Name - Set X" style label into structured info.
 */
function parseNextUpLabel(label: string): { name: string; detail: string } | null {
  if (!label || label === 'Workout complete!') return null;
  const match = label.match(/^Next:\s*(.+?)\s*-\s*(.+)$/);
  if (match) {
    return { name: match[1], detail: match[2] };
  }
  return { name: label, detail: '' };
}

export function RestTimer({
  remainingMs,
  totalMs,
  isSuperset,
  nextUpLabel,
  nextUpInfo,
  onSkip,
  onAdjust,
}: RestTimerProps) {
  const parsed = nextUpLabel ? parseNextUpLabel(nextUpLabel) : null;
  const nextName = nextUpInfo?.exerciseName ?? parsed?.name ?? null;
  const nextDetail = nextUpInfo
    ? buildDetailString(nextUpInfo)
    : parsed?.detail ?? null;

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-8">
      {/* Superset label (only shown for superset rest) */}
      {isSuperset ? (
        <span className="mb-4 text-lg font-semibold tracking-wider text-accent">
          SUPERSET REST
        </span>
      ) : null}

      {/* Timer ring (includes REST label inside) */}
      <TimerRing remainingMs={remainingMs} totalMs={totalMs} size={200} />

      {/* Control buttons */}
      <div className="mt-8 flex items-center justify-center gap-4">
        {/* -10s button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjust(-10)}
            className={[
              'flex h-14 w-14 items-center justify-center',
              'rounded-full bg-elevated border border-border',
              'transition-all duration-150',
              'active:scale-95',
            ].join(' ')}
            aria-label="Subtract 10 seconds"
          >
            <Minus className="h-5 w-5 text-text-primary" />
          </button>
          <span className="text-sm text-text-muted">-10s</span>
        </div>

        {/* Skip button */}
        <button
          type="button"
          onClick={onSkip}
          className={[
            'flex h-12 items-center gap-2 px-6',
            'rounded-3xl bg-accent text-white',
            'font-semibold transition-all duration-150',
            'active:scale-95 hover:bg-accent/90',
          ].join(' ')}
          aria-label="Skip rest"
        >
          <span>Skip</span>
          <SkipForward className="h-4 w-4" />
        </button>

        {/* +10s button */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onAdjust(10)}
            className={[
              'flex h-14 w-14 items-center justify-center',
              'rounded-full bg-elevated border border-border',
              'transition-all duration-150',
              'active:scale-95',
            ].join(' ')}
            aria-label="Add 10 seconds"
          >
            <Plus className="h-5 w-5 text-text-primary" />
          </button>
          <span className="text-sm text-text-muted">+10s</span>
        </div>
      </div>

      {/* Next Up section */}
      {nextName ? (
        <div className="mt-10 flex flex-col items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-[1px] text-text-muted">
            NEXT UP
          </span>
          <span className="text-lg font-semibold text-white">
            {nextName}
          </span>
          {nextDetail ? (
            <span className="text-sm text-text-secondary">
              {nextDetail}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Builds a human-readable detail string like "Set 2 of 4 - 8-12 reps".
 */
function buildDetailString(info: NextUpInfo): string {
  const parts: string[] = [];
  if (info.setNumber != null && info.totalSets != null) {
    parts.push(`Set ${info.setNumber} of ${info.totalSets}`);
  }
  if (info.repsMin != null) {
    if (info.repsMax != null && info.repsMax !== info.repsMin) {
      parts.push(`${info.repsMin}-${info.repsMax} reps`);
    } else {
      parts.push(`${info.repsMin} reps`);
    }
  }
  return parts.join(' \u00B7 ');
}
