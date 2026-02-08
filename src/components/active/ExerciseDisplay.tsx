'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui';
import { useHaptics } from '@/hooks';
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
}: ExerciseDisplayProps) => {
  const haptics = useHaptics();
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  const initialVisualSrc = useMemo(() => {
    const key = visualKey && visualKey.trim().length > 0 ? visualKey : 'default';
    return `/visuals/exercises/${key}.svg`;
  }, [visualKey]);

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
    let cancelled = false;
    getLastPerformedSets(exerciseId).then((sets) => {
      if (cancelled) return;
      setWeightHint(computeWeightSuggestion(sets, unitSystem));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [exerciseId, unitSystem]);

  const handleDone = useCallback(() => {
    haptics.press();
    onDone();
  }, [onDone, haptics]);

  const repLabel =
    repsMin === repsMax
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
        <p className="text-sm text-text-muted">
          Last avg {formatWeight(weightHint.avgG, unitSystem)}
          {' · '}
          Try{' '}
          <span className="font-semibold text-accent">
            [{formatWeight(weightHint.suggestedG, unitSystem)}]
          </span>
        </p>
      ) : null}

      {/* Done button */}
      <div className="mt-auto w-full">
        <Button
          size="xl"
          fullWidth
          onClick={handleDone}
          className="rounded-2xl font-bold"
        >
          DONE
        </Button>
      </div>
    </div>
  );
};
