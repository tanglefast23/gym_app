'use client';

import { Minus, Plus, SkipForward } from 'lucide-react';
import { TimerRing } from './TimerRing';

interface RestTimerProps {
  remainingMs: number;
  totalMs: number;
  isSuperset?: boolean;
  nextUpLabel?: string;
  onSkip: () => void;
  onAdjust: (seconds: number) => void;
}

export const RestTimer = ({
  remainingMs,
  totalMs,
  isSuperset,
  nextUpLabel,
  onSkip,
  onAdjust,
}: RestTimerProps) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-8">
      {/* Rest label */}
      <span className="text-lg font-semibold tracking-wider text-accent">
        {isSuperset ? 'SUPERSET REST' : 'REST'}
      </span>

      {/* Timer ring */}
      <TimerRing remainingMs={remainingMs} totalMs={totalMs} size={200} />

      {/* Control buttons */}
      <div className="flex items-center gap-6">
        {/* -10s button */}
        <button
          type="button"
          onClick={() => onAdjust(-10)}
          className={[
            'flex h-14 w-14 items-center justify-center',
            'rounded-full bg-surface border border-border',
            'transition-all duration-150',
            'active:scale-95',
          ].join(' ')}
          aria-label="Subtract 10 seconds"
        >
          <span className="flex items-center gap-0.5 text-sm font-medium text-text-primary">
            <Minus className="h-3 w-3" />
            10
          </span>
        </button>

        {/* Skip button */}
        <button
          type="button"
          onClick={onSkip}
          className={[
            'flex h-12 items-center gap-2 px-6',
            'rounded-full bg-accent text-white',
            'font-semibold transition-all duration-150',
            'active:scale-95 hover:bg-accent/90',
          ].join(' ')}
          aria-label="Skip rest"
        >
          <span>Skip</span>
          <SkipForward className="h-4 w-4" />
        </button>

        {/* +10s button */}
        <button
          type="button"
          onClick={() => onAdjust(10)}
          className={[
            'flex h-14 w-14 items-center justify-center',
            'rounded-full bg-surface border border-border',
            'transition-all duration-150',
            'active:scale-95',
          ].join(' ')}
          aria-label="Add 10 seconds"
        >
          <span className="flex items-center gap-0.5 text-sm font-medium text-text-primary">
            <Plus className="h-3 w-3" />
            10
          </span>
        </button>
      </div>

      {/* Next up preview */}
      {nextUpLabel ? (
        <div className="w-full rounded-xl bg-surface p-3">
          <p className="text-center text-sm text-text-secondary">
            {nextUpLabel}
          </p>
        </div>
      ) : null}
    </div>
  );
};
