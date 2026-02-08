'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Copy, CopyCheck } from 'lucide-react';
import { Button, Stepper } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  formatWeightValue,
  displayToGrams,
  gramsToKg,
  gramsToLb,
} from '@/lib/calculations';
import type { WorkoutStep, PerformedSet } from '@/types/workout';

interface WeightRecapProps {
  steps: WorkoutStep[];
  performedSets: Array<PerformedSet | null>;
  /** Optional map of exerciseId -> exerciseName for better display/snapshots. */
  exerciseNameMap?: Map<string, string>;
  onUpsertSet: (index: number, set: PerformedSet) => void;
  onComplete: () => void;
  onSavePartial: () => void;
}

/** Filter to only exercise-type steps. */
function getExerciseSteps(steps: WorkoutStep[]): WorkoutStep[] {
  return steps.filter((s) => s.type === 'exercise');
}

function findPreviousSetWeight(
  performedSets: Array<PerformedSet | null>,
  exerciseId: string,
  beforeIndex: number,
): number | null {
  for (let i = Math.min(beforeIndex - 1, performedSets.length - 1); i >= 0; i--) {
    const s = performedSets[i];
    if (s && s.exerciseId === exerciseId) return s.weightG;
  }
  return null;
}

export const WeightRecap = ({
  steps,
  performedSets,
  exerciseNameMap,
  onUpsertSet,
  onComplete,
  onSavePartial,
}: WeightRecapProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const weightStepsKg = useSettingsStore((s) => s.weightStepsKg);
  const weightStepsLb = useSettingsStore((s) => s.weightStepsLb);

  const exerciseSteps = useMemo(() => getExerciseSteps(steps), [steps]);
  const totalSets = exerciseSteps.length;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftWeightG, setDraftWeightG] = useState<number>(() => {
    const step = exerciseSteps[0];
    const existing = performedSets[0];
    if (existing) return existing.weightG;
    const prevWeight = step?.exerciseId
      ? findPreviousSetWeight(performedSets, step.exerciseId, 0)
      : null;
    return prevWeight ?? 0;
  });
  const [draftReps, setDraftReps] = useState<number>(() => {
    const step = exerciseSteps[0];
    const existing = performedSets[0];
    if (existing) return existing.repsDone;
    return step?.repsMax ?? step?.repsMin ?? 0;
  });

  const currentStep = exerciseSteps[currentIndex];
  const currentExerciseName = useMemo(() => {
    if (!currentStep) return '';
    const exerciseId = currentStep.exerciseId ?? '';
    return (
      (exerciseId ? exerciseNameMap?.get(exerciseId) : undefined) ??
      currentStep.exerciseName ??
      'Exercise'
    );
  }, [currentStep, exerciseNameMap]);

  /** Weight step in grams (uses the first weight step from settings). */
  const weightStepValues =
    unitSystem === 'kg' ? weightStepsKg : weightStepsLb;
  const weightStep = weightStepValues[0] ?? (unitSystem === 'kg' ? 2.5 : 5);
  /** Convert grams to display value for the stepper. */
  const weightDisplay =
    unitSystem === 'kg' ? gramsToKg(draftWeightG) : gramsToLb(draftWeightG);

  /** Initialize draft values when navigating to a new set. */
  const initializeDraft = useCallback(
    (index: number) => {
      const step = exerciseSteps[index];
      if (!step) return;

      const existingSet = performedSets[index];

      if (existingSet) {
        setDraftWeightG(existingSet.weightG);
        setDraftReps(existingSet.repsDone);
        return;
      }

      // Prefill reps to repsMax
      setDraftReps(step.repsMax ?? step.repsMin ?? 0);

      // Prefill weight from previous set of same exercise
      const prevWeight = step.exerciseId
        ? findPreviousSetWeight(performedSets, step.exerciseId, index)
        : null;
      setDraftWeightG(prevWeight ?? 0);
    },
    [exerciseSteps, performedSets],
  );

  /** Save the current draft as a performed set. */
  const saveDraft = useCallback(() => {
    if (!currentStep) return;

    const performedSet: PerformedSet = {
      exerciseId: currentStep.exerciseId ?? '',
      exerciseNameSnapshot: currentExerciseName,
      blockPath: `block-${currentStep.blockIndex}`,
      setIndex: currentStep.setIndex ?? 0,
      repsTargetMin: currentStep.repsMin ?? 0,
      repsTargetMax: currentStep.repsMax ?? 0,
      repsDone: draftReps,
      weightG: draftWeightG,
    };

    onUpsertSet(currentIndex, performedSet);
  }, [
    currentStep,
    currentExerciseName,
    currentIndex,
    draftReps,
    draftWeightG,
    onUpsertSet,
  ]);

  /** Apply current weight to all remaining sets of the same exercise. */
  const applyToRemaining = useCallback(() => {
    if (!currentStep?.exerciseId) return;
    const exerciseId = currentStep.exerciseId;

    for (let i = currentIndex; i < exerciseSteps.length; i++) {
      if (exerciseSteps[i].exerciseId !== exerciseId) continue;

      const step = exerciseSteps[i];
      const set: PerformedSet = {
        exerciseId,
        exerciseNameSnapshot:
          exerciseNameMap?.get(exerciseId) ?? step.exerciseName ?? 'Exercise',
        blockPath: `block-${step.blockIndex}`,
        setIndex: step.setIndex ?? 0,
        repsTargetMin: step.repsMin ?? 0,
        repsTargetMax: step.repsMax ?? 0,
        repsDone: draftReps,
        weightG: draftWeightG,
      };

      onUpsertSet(i, set);
    }
  }, [
    currentStep,
    currentIndex,
    exerciseSteps,
    draftReps,
    draftWeightG,
    exerciseNameMap,
    onUpsertSet,
  ]);

  /** Copy weight from the previous set of this exercise. */
  const applySameWeight = useCallback(() => {
    if (!currentStep?.exerciseId) return;
    const prevWeight = findPreviousSetWeight(
      performedSets,
      currentStep.exerciseId,
      currentIndex,
    );
    if (prevWeight !== null) {
      setDraftWeightG(prevWeight);
    }
  }, [currentStep, performedSets, currentIndex]);

  /** Handle weight change from stepper (value in display units). */
  const handleWeightChange = useCallback(
    (displayValue: number) => {
      setDraftWeightG(displayToGrams(displayValue, unitSystem));
    },
    [unitSystem],
  );

  /** Move to next set or complete. */
  const handleNext = useCallback(() => {
    saveDraft();
    if (currentIndex < totalSets - 1) {
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);
      initializeDraft(nextIndex);
    }
  }, [saveDraft, currentIndex, totalSets, initializeDraft]);

  /** Move to previous set. */
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      saveDraft();
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      initializeDraft(prevIndex);
    }
  }, [saveDraft, currentIndex, initializeDraft]);

  /** Handle complete: save current draft then call onComplete. */
  const handleComplete = useCallback(() => {
    saveDraft();
    onComplete();
  }, [saveDraft, onComplete]);

  const loggedCount = useMemo(
    () => performedSets.filter((s) => s != null).length,
    [performedSets],
  );

  /** Count sets for current exercise. */
  const currentExerciseSets = useMemo(() => {
    if (!currentStep?.exerciseId) return { current: 0, total: 0 };
    let count = 0;
    let current = 0;
    for (const step of exerciseSteps) {
      if (step.exerciseId === currentStep.exerciseId) {
        count++;
        if (step === currentStep) current = count;
      }
    }
    return { current, total: count };
  }, [currentStep, exerciseSteps]);

  const allSetsLogged = loggedCount >= totalSets;
  const hasPreviousSetWeight =
    currentStep?.exerciseId
      ? findPreviousSetWeight(performedSets, currentStep.exerciseId, currentIndex) !==
        null
      : false;

  if (!currentStep) return null;

  return (
    <div className="flex h-full flex-col px-6 py-6">
      {/* Header */}
      <h2 className="text-center text-2xl font-bold text-text-primary">
        Log Your Weights
      </h2>

      {/* Progress */}
      <p className="mt-2 text-center text-sm text-text-secondary">
        {loggedCount}/{totalSets} sets logged
      </p>

      {/* Current set card */}
      <div className="mt-6 flex-1">
        <div className="rounded-2xl bg-surface p-6">
          {/* Exercise name */}
          <h3 className="text-center text-lg font-semibold text-text-primary">
            {currentExerciseName}
          </h3>

          {/* Set indicator */}
          <p className="mt-1 text-center text-sm text-text-secondary">
            Set {currentExerciseSets.current} of {currentExerciseSets.total}
          </p>

          {/* Weight stepper */}
          <div className="mt-6">
            <Stepper
              value={weightDisplay}
              onChange={handleWeightChange}
              step={weightStep}
              min={0}
              label={`Weight (${unitSystem})`}
              formatValue={(v) =>
                formatWeightValue(
                  displayToGrams(v, unitSystem),
                  unitSystem,
                )
              }
            />
          </div>

          {/* Reps stepper */}
          <div className="mt-4">
            <Stepper
              value={draftReps}
              onChange={setDraftReps}
              step={1}
              min={0}
              max={999}
              label="Reps"
            />
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 flex gap-3">
            {/* Same weight button */}
            <button
              type="button"
              onClick={applySameWeight}
              disabled={!hasPreviousSetWeight}
              className={[
                'flex flex-1 items-center justify-center gap-2',
                'rounded-xl bg-elevated px-3 py-2.5',
                'text-sm font-medium text-text-secondary',
                'transition-all duration-150',
                hasPreviousSetWeight
                  ? 'hover:bg-surface active:scale-[0.97]'
                  : 'opacity-50 cursor-not-allowed',
              ].join(' ')}
            >
              <CopyCheck className="h-4 w-4" />
              Same weight
            </button>

            {/* Apply to remaining button */}
            <button
              type="button"
              onClick={applyToRemaining}
              className={[
                'flex flex-1 items-center justify-center gap-2',
                'rounded-xl bg-elevated px-3 py-2.5',
                'text-sm font-medium text-text-secondary',
                'transition-all duration-150',
                'hover:bg-surface active:scale-[0.97]',
              ].join(' ')}
            >
              <Copy className="h-4 w-4" />
              Apply to remaining
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </Button>

        {currentIndex < totalSets - 1 ? (
          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {/* Save buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {allSetsLogged ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleComplete}
          >
            Save Workout
          </Button>
        ) : null}

        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={() => {
            saveDraft();
            onSavePartial();
          }}
        >
          Save Partial
        </Button>
      </div>
    </div>
  );
};
