'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { Check, TrendingUp } from 'lucide-react';
import { Button, AMRAP_SENTINEL } from '@/components/ui';
import { useHaptics } from '@/hooks';
import { getVisualKeyForExerciseName } from '@/lib/exerciseVisual';
import { getLastPerformedSets } from '@/lib/queries';
import { formatWeight } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import type { PerformedSet } from '@/types/workout';

interface ExerciseDisplayProps {
  exerciseName: string;
  exerciseId?: string;
  setIndex: number;
  totalSets: number;
  repsMin: number;
  repsMax: number;
  visualKey?: string;
  isSuperset?: boolean;
  supersetExerciseIndex?: number;
  supersetTotalExercises?: number;
  onDone: () => void;
  /** Called when the weight hint is computed so the parent can use it for prefill. */
  onWeightHintReady?: (avgG: number) => void;
}

/** Compute average weight and a suggested bump from previous sets. */
function computeWeightSuggestion(
  sets: PerformedSet[],
  unit: 'kg' | 'lb',
): { avgG: number; suggestedG: number } | null {
  const withWeight = sets.filter((s) => s.weightG > 0);
  if (withWeight.length === 0) return null;

  const totalG = withWeight.reduce((sum, s) => sum + s.weightG, 0);
  const avgG = Math.round(totalG / withWeight.length);

  // Modest increase: +2.5kg or +5lb (in grams)
  const bumpG = unit === 'kg' ? 2500 : 2268; // 2.5kg or ~5lb
  const suggestedG = avgG + bumpG;

  return { avgG, suggestedG };
}

// Module-level cache — persists across remounts within the same workout session.
const exerciseHistoryCache = new Map<string, PerformedSet[]>();

/** Clear the history cache so the next workout fetches fresh data. */
export function clearExerciseHistoryCache(): void {
  exerciseHistoryCache.clear();
}

export const ExerciseDisplay = ({
  exerciseName,
  exerciseId,
  setIndex,
  totalSets,
  repsMin,
  repsMax,
  visualKey,
  isSuperset,
  supersetExerciseIndex,
  supersetTotalExercises,
  onDone,
  onWeightHintReady,
}: ExerciseDisplayProps) => {
  const haptics = useHaptics();
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  const initialVisualSrc = useMemo(() => {
    const explicit = visualKey?.trim().toLowerCase();
    const resolvedKey =
      explicit && explicit.length > 0 && explicit !== 'default'
        ? explicit
        : getVisualKeyForExerciseName(exerciseName);
    return `/visuals/exercises/${resolvedKey}.svg`;
  }, [visualKey, exerciseName]);

  const [visualSrc, setVisualSrc] = useState(initialVisualSrc);

  useEffect(() => {
    setVisualSrc(initialVisualSrc);
  }, [initialVisualSrc]);

  // Fetch previous session's weight data
  const [weightHint, setWeightHint] = useState<{
    avgG: number;
    suggestedG: number;
  } | null>(null);

  useEffect(() => {
    if (!exerciseId) return;

    const applyHint = (sets: PerformedSet[]): void => {
      const hint = computeWeightSuggestion(sets, unitSystem);
      setWeightHint(hint);
      if (hint) onWeightHintReady?.(hint.avgG);
    };

    // Check cache first — avoids redundant IndexedDB queries on remount
    const cached = exerciseHistoryCache.get(exerciseId);
    if (cached) {
      applyHint(cached);
      return;
    }

    let cancelled = false;
    getLastPerformedSets(exerciseId).then((sets) => {
      if (cancelled) return;
      exerciseHistoryCache.set(exerciseId, sets);
      applyHint(sets);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [exerciseId, unitSystem, onWeightHintReady]);

  const [doneFeedback, setDoneFeedback] = useState(false);
  const doneTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (doneTimeoutRef.current !== null) {
        clearTimeout(doneTimeoutRef.current);
      }
    };
  }, []);

  const handleDone = useCallback(() => {
    if (doneFeedback) return;
    haptics.press();
    setDoneFeedback(true);
    // Tiny "registered" beat before advancing to the next step.
    doneTimeoutRef.current = window.setTimeout(() => {
      doneTimeoutRef.current = null;
      setDoneFeedback(false);
      onDone();
    }, 110);
  }, [onDone, haptics, doneFeedback]);

  const repLabel =
    repsMax === AMRAP_SENTINEL
      ? 'MAX reps'
      : repsMin === repsMax
        ? `${repsMin} reps`
        : `${repsMin}-${repsMax} reps`;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-8">
      {/* Superset badge with round counter */}
      {isSuperset &&
      supersetExerciseIndex !== undefined &&
      supersetTotalExercises !== undefined ? (
        <div className="flex flex-col items-center gap-1">
          <span className="rounded-full bg-accent/20 px-4 py-1 text-sm font-semibold text-accent">
            SUPERSET
          </span>
          <span className="text-sm font-medium text-text-secondary">
            Round {setIndex + 1} of {totalSets}
          </span>
          <span className="text-xs text-text-muted">
            Exercise {supersetExerciseIndex + 1} of {supersetTotalExercises}
          </span>
        </div>
      ) : null}

      {/* Exercise name */}
      <h2 className="text-center text-2xl font-bold text-text-primary">
        {exerciseName}
      </h2>

      {/* Visual placeholder */}
      <div className="flex h-[140px] w-[140px] items-center justify-center overflow-hidden rounded-2xl bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={visualSrc}
          alt=""
          className="h-[120px] w-[120px] select-none opacity-95"
          draggable={false}
          onError={() => setVisualSrc('/visuals/exercises/default.svg')}
        />
      </div>

      {/* Set indicator (hidden for supersets — round info is in the badge above) */}
      {!isSuperset ? (
        <p className="text-lg text-text-secondary">
          Set {setIndex + 1} of {totalSets}
        </p>
      ) : null}

      {/* Rep target */}
      <p className="text-3xl font-bold text-accent">{repLabel}</p>

      {/* Previous avg + suggested weight */}
      {weightHint ? (
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-muted">
            <span>
              Last avg <span className="font-semibold text-text-secondary">{formatWeight(weightHint.avgG, unitSystem)}</span>
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="text-text-secondary">Try</span>
              <span className="relative font-semibold text-accent">
                {formatWeight(weightHint.suggestedG, unitSystem)}
                <span className="absolute left-0 right-0 -bottom-[2px] h-[2px] rounded-full bg-accent/60" />
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {/* Done button */}
      <div className="mt-auto w-full">
        <Button
          size="xl"
          fullWidth
          onClick={handleDone}
          disabled={doneFeedback}
          className="relative rounded-2xl font-bold animate-pulse-glow"
        >
          <span className={doneFeedback ? 'opacity-0' : 'opacity-100'}>
            DONE
          </span>
          {doneFeedback ? (
            <span className="absolute inset-0 flex items-center justify-center animate-check-pop">
              <Check className="h-7 w-7 text-white" />
            </span>
          ) : null}
        </Button>
      </div>
    </div>
  );
};
