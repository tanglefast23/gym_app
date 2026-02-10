import { useMemo } from 'react';
import type { WorkoutStep, ExerciseStep } from '@/types/workout';

// -----------------------------------------------------------------------------
// Helper: build a "next up" label from the rest of the step list
// -----------------------------------------------------------------------------

/**
 * Scans forward from the current rest step to find the next exercise step
 * and returns a human-readable preview string.
 */
function buildNextUpLabel(
  allSteps: WorkoutStep[],
  currentIndex: number,
  nameMap: Map<string, string>,
): string {
  for (let i = currentIndex + 1; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.type === 'exercise') {
      const name =
        nameMap.get(step.exerciseId) ??
        step.exerciseName ??
        'Exercise';
      const set = step.setIndex + 1;
      return `Next: ${name} - Set ${set}`;
    }
  }
  return 'Workout complete!';
}

// -----------------------------------------------------------------------------
// Return type
// -----------------------------------------------------------------------------

export interface ActiveWorkoutDerived {
  /** e.g. "3 / 12" — current exercise ordinal vs total exercise steps. */
  stepProgressText: string;
  /** Resolved exercise name for the current step, empty when not on an exercise. */
  currentExerciseName: string;
  /** Visual illustration key for the current exercise step. */
  currentExerciseVisualKey: string | undefined;
  /** "Next: Bench Press - Set 2" or "Workout complete!" during rest steps. */
  nextUpLabel: string;
  /** Only the exercise-type steps (used for recap filtering). */
  exerciseSteps: ExerciseStep[];
  /** Screen-reader announcement text for the current step. */
  ariaStepAnnouncement: string;
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Consolidates the five useMemo-derived values that the active workout page
 * needs from the step list, current index, and exercise maps.
 *
 * By grouping these into a single hook, the page component stays thin and
 * the derivation logic is co-located and testable.
 */
export function useActiveWorkoutDerived(
  steps: WorkoutStep[],
  currentStepIndex: number,
  exerciseNameMap: Map<string, string>,
  exerciseVisualMap: Map<string, string>,
): ActiveWorkoutDerived {
  const currentStep: WorkoutStep | undefined = steps[currentStepIndex];

  const exerciseSteps = useMemo(
    () => steps.filter((s): s is ExerciseStep => s.type === 'exercise'),
    [steps],
  );

  const stepProgressText = useMemo(() => {
    const total = exerciseSteps.length;
    let currentExIdx = 0;
    for (let i = 0; i <= currentStepIndex && i < steps.length; i++) {
      if (steps[i].type === 'exercise') {
        currentExIdx++;
      }
    }
    return `${Math.min(currentExIdx, total)} / ${total}`;
  }, [steps, currentStepIndex, exerciseSteps.length]);

  const currentExerciseName = useMemo(() => {
    if (!currentStep || currentStep.type !== 'exercise') return '';
    return (
      exerciseNameMap.get(currentStep.exerciseId) ??
      currentStep.exerciseName ??
      'Exercise'
    );
  }, [currentStep, exerciseNameMap]);

  const currentExerciseVisualKey = useMemo(() => {
    if (!currentStep || currentStep.type !== 'exercise') return undefined;
    return (
      exerciseVisualMap.get(currentStep.exerciseId) ??
      currentStep.visualKey
    );
  }, [currentStep, exerciseVisualMap]);

  const nextUpLabel = useMemo(
    () => buildNextUpLabel(steps, currentStepIndex, exerciseNameMap),
    [steps, currentStepIndex, exerciseNameMap],
  );

  const ariaStepAnnouncement = useMemo(() => {
    if (!currentStep) return '';

    if (currentStep.type === 'exercise') {
      const name =
        exerciseNameMap.get(currentStep.exerciseId) ??
        currentStep.exerciseName ??
        'Exercise';
      const set = currentStep.setIndex + 1;
      const totalSets = currentStep.totalSets;
      return `Now: ${name} - Set ${set} of ${totalSets}`;
    }

    if (currentStep.type === 'rest' || currentStep.type === 'superset-rest') {
      return `Rest: ${currentStep.restDurationSec} seconds`;
    }

    if (currentStep.type === 'complete') {
      return 'Workout complete';
    }

    return '';
  }, [currentStep, exerciseNameMap]);

  return {
    stepProgressText,
    currentExerciseName,
    currentExerciseVisualKey,
    nextUpLabel,
    exerciseSteps,
    ariaStepAnnouncement,
  };
}
