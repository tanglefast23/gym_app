'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Minus, Plus, Play, SkipForward } from 'lucide-react';
import { TimerRing } from './TimerRing';
import { useHaptics } from '@/hooks';
import { AMRAP_SENTINEL } from '@/components/ui';

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
  isRunning?: boolean;
  nextUpLabel?: string;
  nextUpInfo?: NextUpInfo;
  /** Label shown inside the ring (defaults to "REST"). */
  ringLabel?: string;
  /** Brief "finished" flash when the timer hits 0 (before auto-advance). */
  finishFlash?: boolean;
  onSkip: () => void;
  onAdjust: (seconds: number) => void;
  onStart?: () => void;
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
  isRunning = true,
  nextUpLabel,
  nextUpInfo,
  ringLabel,
  finishFlash = false,
  onSkip,
  onAdjust,
  onStart,
}: RestTimerProps) {
  const haptics = useHaptics();

  const handleSkip = useCallback(() => {
    haptics.tap();
    onSkip();
  }, [haptics, onSkip]);

  const handleAdjust = useCallback(
    (seconds: number) => {
      haptics.tap();
      onAdjust(seconds);
    },
    [haptics, onAdjust],
  );

  // Screen flash during countdown (last 5 seconds, once per second).
  // Uses a ref + direct DOM to avoid setState-in-effect lint issues.
  const flashRef = useRef<HTMLDivElement>(null);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const prevSecRef = useRef(remainingSec);

  useEffect(() => {
    if (remainingSec === prevSecRef.current) return;
    prevSecRef.current = remainingSec;
    if (remainingSec < 1 || remainingSec > 5) return;

    const el = flashRef.current;
    if (!el) return;
    el.style.opacity = '1';
    const id = requestAnimationFrame(() => {
      // Trigger reflow then animate out
      el.style.transition = 'opacity 0.15s ease-out';
      el.style.opacity = '0';
    });
    return () => cancelAnimationFrame(id);
  }, [remainingSec]);

  const parsed = nextUpLabel ? parseNextUpLabel(nextUpLabel) : null;
  const nextName = nextUpInfo?.exerciseName ?? parsed?.name ?? null;
  const nextDetail = nextUpInfo
    ? buildDetailString(nextUpInfo)
    : parsed?.detail ?? null;

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-6 py-8">
      {/* Countdown flash overlay */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 z-50 bg-white/10"
        style={{ opacity: 0 }}
      />

      {/* Finished flash overlay (green beat) */}
      {finishFlash ? (
        <div className="pointer-events-none absolute inset-0 z-50 bg-success/15 animate-flash" />
      ) : null}

      {/* Superset label (only shown for superset rest) */}
      {isSuperset ? (
        <span className="mb-4 text-lg font-semibold tracking-wider text-accent">
          SUPERSET REST
        </span>
      ) : null}

      {/* Timer ring (includes REST label inside) */}
      <TimerRing
        remainingMs={isRunning ? remainingMs : totalMs}
        totalMs={totalMs}
        size={200}
        isRunning={isRunning}
        label={ringLabel}
      />

      {/* Control buttons */}
      {isRunning ? (
        <div className="mt-8 flex items-center justify-center gap-4">
          {/* -10s button */}
          <div className="flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => handleAdjust(-10)}
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
            onClick={handleSkip}
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
              onClick={() => handleAdjust(10)}
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
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => {
              haptics.tap();
              onStart?.();
            }}
            className={[
              'flex h-14 items-center gap-3 px-8',
              'rounded-3xl bg-accent text-white',
              'font-semibold text-lg transition-all duration-150',
              'active:scale-95 hover:bg-accent/90',
            ].join(' ')}
            aria-label="Start rest timer"
          >
            <Play className="h-5 w-5" />
            <span>Start Timer</span>
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm font-medium text-text-muted transition-colors hover:text-text-secondary"
            aria-label="Skip rest"
          >
            Skip rest
          </button>
        </div>
      )}

      {/* Next Up section */}
      {nextName ? (
        <div className="mt-6 flex flex-col items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-[1px] text-text-muted">
            NEXT UP
          </span>
          <span className="text-lg font-semibold text-text-primary">
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
  if (info.repsMax === AMRAP_SENTINEL) {
    parts.push('MAX reps');
  } else if (info.repsMin != null) {
    if (info.repsMax != null && info.repsMax !== info.repsMin) {
      parts.push(`${info.repsMin}-${info.repsMax} reps`);
    } else {
      parts.push(`${info.repsMin} reps`);
    }
  }
  return parts.join(' \u00B7 ');
}
