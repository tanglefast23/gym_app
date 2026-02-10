import type {
  TemplateBlock,
  WorkoutStep,
  ExerciseStep,
  ExerciseBlock,
  SupersetBlock,
} from '@/types/workout';

/**
 * Resolve rest duration using the fallback chain: block -> template -> global.
 *
 * If the block specifies a rest duration, that wins. Otherwise falls back to
 * the template-level default, and finally to the global default.
 *
 * @param blockRest - Block-level rest in seconds, or null if unset
 * @param templateRest - Template-level default rest in seconds, or null if unset
 * @param globalRest - Global default rest in seconds (always defined)
 * @returns The resolved rest duration in seconds
 */
export function resolveRest(
  blockRest: number | null,
  templateRest: number | null,
  globalRest: number,
): number {
  return blockRest ?? templateRest ?? globalRest;
}

/**
 * Resolve transition rest duration using the fallback chain: block -> global.
 *
 * @param blockTransition - Block-level transition rest in seconds, or null if unset
 * @param globalTransition - Global default transition rest in seconds
 * @returns The resolved transition rest duration in seconds
 */
export function resolveTransitionRest(
  blockTransition: number | null | undefined,
  globalTransition: number,
): number {
  return blockTransition ?? globalTransition;
}

/**
 * Count the total number of exercise steps (excluding rest and complete steps).
 *
 * @param steps - The flat list of workout steps
 * @returns The number of steps with type 'exercise'
 */
export function countExerciseSteps(steps: WorkoutStep[]): number {
  return steps.filter((s) => s.type === 'exercise').length;
}

/**
 * Get the exercise step at a given index, returning null if the index is
 * out of bounds or the step at that index is not an exercise.
 *
 * @param steps - The flat list of workout steps
 * @param index - The zero-based index to look up
 * @returns The WorkoutStep if it exists and is an exercise, otherwise null
 */
export function getExerciseStepAt(
  steps: WorkoutStep[],
  index: number,
): ExerciseStep | null {
  const step = steps[index];
  if (!step || step.type !== 'exercise') return null;
  return step;
}

/**
 * Build steps for a single exercise block.
 *
 * Produces the pattern: Set 1 -> rest -> Set 2 -> rest -> ... -> Set N
 * (no trailing rest after the final set).
 */
function buildExerciseBlockSteps(
  block: ExerciseBlock,
  blockIndex: number,
  templateDefaultRest: number | null,
  globalDefaultRest: number,
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  for (let setIdx = 0; setIdx < block.sets; setIdx++) {
    steps.push({
      type: 'exercise',
      blockIndex,
      exerciseId: block.exerciseId,
      setIndex: setIdx,
      totalSets: block.sets,
      repsMin: block.repsMin,
      repsMax: block.repsMax,
      visualKey: undefined,
      isSuperset: false,
    });

    if (setIdx < block.sets - 1) {
      const restSec = resolveRest(
        block.restBetweenSetsSec,
        templateDefaultRest,
        globalDefaultRest,
      );
      steps.push({
        type: 'rest',
        blockIndex,
        restDurationSec: restSec,
      });
    }
  }

  return steps;
}

/**
 * Build steps for a single superset block.
 *
 * For each round:
 *   A(i) -> restBetweenExercises -> B(i) -> restBetweenExercises -> C(i)
 * Then restBetweenSupersets before the next round (no trailing rest after
 * the final round's final exercise).
 */
function buildSupersetBlockSteps(
  block: SupersetBlock,
  blockIndex: number,
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  for (let setIdx = 0; setIdx < block.sets; setIdx++) {
    for (let exIdx = 0; exIdx < block.exercises.length; exIdx++) {
      const ex = block.exercises[exIdx];

      steps.push({
        type: 'exercise',
        blockIndex,
        exerciseId: ex.exerciseId,
        setIndex: setIdx,
        totalSets: block.sets,
        repsMin: ex.repsMin,
        repsMax: ex.repsMax,
        isSuperset: true,
        supersetExerciseIndex: exIdx,
        supersetTotalExercises: block.exercises.length,
      });

      if (exIdx < block.exercises.length - 1) {
        steps.push({
          type: 'rest',
          blockIndex,
          restDurationSec: block.restBetweenExercisesSec,
          isSuperset: true,
        });
      }
    }

    if (setIdx < block.sets - 1) {
      steps.push({
        type: 'superset-rest',
        blockIndex,
        restDurationSec: block.restBetweenSupersetsSec,
        isSuperset: true,
      });
    }
  }

  return steps;
}

/**
 * Generate the flat list of all workout steps from template blocks.
 *
 * Iterates through every block in order, expanding each into its constituent
 * exercise and rest steps. Appends a final 'complete' step at the end.
 *
 * The resulting array is meant to be walked sequentially by the workout
 * execution UI: increment the current step index to advance through the
 * workout.
 *
 * @param blocks - The template blocks (frozen snapshot from the template)
 * @param templateDefaultRest - Template-level default rest in seconds, or null
 * @param globalDefaultRest - Global default rest in seconds, typically 90
 * @returns Ordered array of WorkoutStep objects ending with a 'complete' step
 */
export function generateSteps(
  blocks: TemplateBlock[],
  templateDefaultRest: number | null,
  globalDefaultRest: number,
  globalDefaultTransitions: number,
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];

    if (block.type === 'exercise') {
      const blockSteps = buildExerciseBlockSteps(
        block,
        blockIndex,
        templateDefaultRest,
        globalDefaultRest,
      );
      steps.push(...blockSteps);
    } else if (block.type === 'superset') {
      const blockSteps = buildSupersetBlockSteps(block, blockIndex);
      steps.push(...blockSteps);
    }

    // Transition rest between top-level blocks (no trailing rest after last block)
    if (blockIndex < blocks.length - 1) {
      const restSec = resolveTransitionRest(
        block.transitionRestSec,
        globalDefaultTransitions,
      );
      if (restSec > 0) {
        steps.push({
          type: 'rest',
          blockIndex,
          restDurationSec: restSec,
        });
      }
    }
  }

  steps.push({ type: 'complete', blockIndex: blocks.length });

  return steps;
}
