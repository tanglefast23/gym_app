'use client';

import { Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui';

interface ExerciseDisplayProps {
  exerciseName: string;
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

export const ExerciseDisplay = ({
  exerciseName,
  setIndex,
  totalSets,
  repsMin,
  repsMax,
  isSuperset,
  supersetExerciseIndex,
  supersetTotalExercises,
  onDone,
}: ExerciseDisplayProps) => {
  const repLabel =
    repsMin === repsMax
      ? `${repsMin} reps`
      : `${repsMin}-${repsMax} reps`;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 py-8">
      {/* Superset badge */}
      {isSuperset &&
      supersetExerciseIndex !== undefined &&
      supersetTotalExercises !== undefined ? (
        <div className="flex flex-col items-center gap-1">
          <span className="rounded-full bg-accent/20 px-4 py-1 text-sm font-semibold text-accent">
            SUPERSET
          </span>
          <span className="text-sm text-text-secondary">
            Exercise {supersetExerciseIndex + 1} of {supersetTotalExercises}
          </span>
        </div>
      ) : null}

      {/* Exercise name */}
      <h2 className="text-center text-2xl font-bold text-text-primary">
        {exerciseName}
      </h2>

      {/* Visual placeholder */}
      <div className="flex h-[120px] w-[120px] items-center justify-center rounded-2xl bg-surface">
        <Dumbbell className="h-12 w-12 text-text-muted" />
      </div>

      {/* Set indicator */}
      <p className="text-lg text-text-secondary">
        Set {setIndex + 1} of {totalSets}
      </p>

      {/* Rep target */}
      <p className="text-3xl font-bold text-accent">{repLabel}</p>

      {/* Done button */}
      <div className="mt-auto w-full">
        <Button
          size="xl"
          fullWidth
          onClick={onDone}
          className="rounded-2xl font-bold"
        >
          DONE
        </Button>
      </div>
    </div>
  );
};
