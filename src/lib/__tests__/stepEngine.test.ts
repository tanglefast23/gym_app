import { describe, it, expect } from 'vitest';
import {
  generateSteps,
  resolveRest,
  countExerciseSteps,
  getExerciseStepAt,
} from '../stepEngine';
import type {
  ExerciseBlock,
  ExerciseStep,
  RestStep,
  SupersetBlock,
  TemplateBlock,
} from '@/types/workout';

// ---------------------------------------------------------------------------
// Helpers to build test fixtures
// ---------------------------------------------------------------------------

function makeExerciseBlock(
  overrides: Partial<ExerciseBlock> = {},
): ExerciseBlock {
  return {
    id: 'eb-1',
    type: 'exercise',
    exerciseId: 'ex-bench',
    sets: 3,
    repsMin: 8,
    repsMax: 12,
    restBetweenSetsSec: null,
    transitionRestSec: null,
    ...overrides,
  };
}

function makeSupersetBlock(
  overrides: Partial<SupersetBlock> = {},
): SupersetBlock {
  return {
    id: 'sb-1',
    type: 'superset',
    sets: 2,
    exercises: [
      { exerciseId: 'ex-a', repsMin: 8, repsMax: 10 },
      { exerciseId: 'ex-b', repsMin: 10, repsMax: 12 },
    ],
    restBetweenExercisesSec: 30,
    restBetweenSupersetsSec: 120,
    transitionRestSec: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveRest
// ---------------------------------------------------------------------------

describe('resolveRest', () => {
  it('uses block rest when provided', () => {
    expect(resolveRest(60, 90, 120)).toBe(60);
  });

  it('falls back to template rest when block rest is null', () => {
    expect(resolveRest(null, 90, 120)).toBe(90);
  });

  it('falls back to global rest when both block and template are null', () => {
    expect(resolveRest(null, null, 120)).toBe(120);
  });

  it('uses block rest even when template and global differ', () => {
    expect(resolveRest(45, 90, 120)).toBe(45);
  });
});

// ---------------------------------------------------------------------------
// generateSteps - exercise blocks
// ---------------------------------------------------------------------------

describe('generateSteps with exercise blocks', () => {
  it('generates correct steps for a single block with 3 sets', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 3 })];
    const steps = generateSteps(blocks, null, 90, 30);

    // Expected: ex, rest, ex, rest, ex, complete = 6 steps
    expect(steps).toHaveLength(6);
    expect(steps[0].type).toBe('exercise');
    expect(steps[1].type).toBe('rest');
    expect(steps[2].type).toBe('exercise');
    expect(steps[3].type).toBe('rest');
    expect(steps[4].type).toBe('exercise');
    expect(steps[5].type).toBe('complete');
  });

  it('generates only exercise + complete for a single set', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 1 })];
    const steps = generateSteps(blocks, null, 90, 30);

    // Expected: ex, complete = 2 steps (no rest after single set)
    expect(steps).toHaveLength(2);
    expect(steps[0].type).toBe('exercise');
    expect(steps[1].type).toBe('complete');
  });

  it('interleaves two exercise blocks correctly', () => {
    const blocks: TemplateBlock[] = [
      makeExerciseBlock({ id: 'eb-1', exerciseId: 'ex-bench', sets: 2 }),
      makeExerciseBlock({ id: 'eb-2', exerciseId: 'ex-squat', sets: 2 }),
    ];
    const steps = generateSteps(blocks, null, 90, 30);

    // Block 1: ex, rest, ex  (3 steps)
    // Transition: rest (1 step)
    // Block 2: ex, rest, ex  (3 steps)
    // + complete = 8 steps
    expect(steps).toHaveLength(8);
    const exSteps = steps.filter((s): s is ExerciseStep => s.type === 'exercise');
    expect(exSteps[0].exerciseId).toBe('ex-bench');
    expect(exSteps[1].exerciseId).toBe('ex-bench');
    expect(exSteps[2].exerciseId).toBe('ex-squat');
    expect(exSteps[3].exerciseId).toBe('ex-squat');
    expect(steps[7].type).toBe('complete');
  });

  it('applies block rest over template and global defaults', () => {
    const blocks: TemplateBlock[] = [
      makeExerciseBlock({ sets: 2, restBetweenSetsSec: 45 }),
    ];
    const steps = generateSteps(blocks, 90, 120, 30);
    const restStep = steps.find((s): s is RestStep => s.type === 'rest');
    expect(restStep?.restDurationSec).toBe(45);
  });

  it('falls back to template rest when block rest is null', () => {
    const blocks: TemplateBlock[] = [
      makeExerciseBlock({ sets: 2, restBetweenSetsSec: null }),
    ];
    const steps = generateSteps(blocks, 75, 120, 30);
    const restStep = steps.find((s): s is RestStep => s.type === 'rest');
    expect(restStep?.restDurationSec).toBe(75);
  });

  it('assigns correct setIndex and totalSets', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 3 })];
    const steps = generateSteps(blocks, null, 90, 30);
    const exerciseSteps = steps.filter((s): s is ExerciseStep => s.type === 'exercise');

    expect(exerciseSteps[0].setIndex).toBe(0);
    expect(exerciseSteps[1].setIndex).toBe(1);
    expect(exerciseSteps[2].setIndex).toBe(2);
    exerciseSteps.forEach((s) => expect(s.totalSets).toBe(3));
  });
});

// ---------------------------------------------------------------------------
// generateSteps - superset blocks
// ---------------------------------------------------------------------------

describe('generateSteps with superset blocks', () => {
  it('generates correct steps for 2 exercises, 2 sets', () => {
    const blocks: TemplateBlock[] = [makeSupersetBlock({ sets: 2 })];
    const steps = generateSteps(blocks, null, 90, 30);

    // Round 1: A(0), rest, B(0), superset-rest
    // Round 2: A(1), rest, B(1)
    // + complete
    // = 4 + 3 + 1 = 8 steps
    expect(steps).toHaveLength(8);
    const exSteps = steps.filter((s): s is ExerciseStep => s.type === 'exercise');
    expect(exSteps[0].exerciseId).toBe('ex-a');
    expect(exSteps[1].exerciseId).toBe('ex-b');
    expect(steps[3].type).toBe('superset-rest');
    expect(exSteps[2].exerciseId).toBe('ex-a');
    expect(exSteps[3].exerciseId).toBe('ex-b');
    expect(steps[7].type).toBe('complete');
  });

  it('marks superset exercise steps with correct metadata', () => {
    const blocks: TemplateBlock[] = [makeSupersetBlock({ sets: 1 })];
    const steps = generateSteps(blocks, null, 90, 30);
    const exerciseSteps = steps.filter((s): s is ExerciseStep => s.type === 'exercise');

    exerciseSteps.forEach((s) => {
      expect(s.isSuperset).toBe(true);
      expect(s.supersetTotalExercises).toBe(2);
    });
    expect(exerciseSteps[0].supersetExerciseIndex).toBe(0);
    expect(exerciseSteps[1].supersetExerciseIndex).toBe(1);
  });

  it('generates correct steps for 3 exercises, 1 set (no trailing superset-rest)', () => {
    const blocks: TemplateBlock[] = [
      makeSupersetBlock({
        sets: 1,
        exercises: [
          { exerciseId: 'ex-a', repsMin: 8, repsMax: 10 },
          { exerciseId: 'ex-b', repsMin: 10, repsMax: 12 },
          { exerciseId: 'ex-c', repsMin: 6, repsMax: 8 },
        ],
      }),
    ];
    const steps = generateSteps(blocks, null, 90, 30);

    // A, rest, B, rest, C, complete = 6 steps
    expect(steps).toHaveLength(6);
    const exSteps = steps.filter((s): s is ExerciseStep => s.type === 'exercise');
    expect(exSteps[0].exerciseId).toBe('ex-a');
    expect(steps[1].type).toBe('rest');
    expect(exSteps[1].exerciseId).toBe('ex-b');
    expect(steps[3].type).toBe('rest');
    expect(exSteps[2].exerciseId).toBe('ex-c');
    expect(steps[5].type).toBe('complete');
  });

  it('does not append superset-rest after the final round', () => {
    const blocks: TemplateBlock[] = [makeSupersetBlock({ sets: 2 })];
    const steps = generateSteps(blocks, null, 90, 30);

    // The step before 'complete' should NOT be 'superset-rest'
    const lastBeforeComplete = steps[steps.length - 2];
    expect(lastBeforeComplete.type).toBe('exercise');
  });
});

// ---------------------------------------------------------------------------
// Mixed blocks
// ---------------------------------------------------------------------------

describe('generateSteps with mixed blocks', () => {
  it('handles exercise block followed by superset block', () => {
    const blocks: TemplateBlock[] = [
      makeExerciseBlock({ sets: 2 }),
      makeSupersetBlock({ sets: 1 }),
    ];
    const steps = generateSteps(blocks, null, 90, 30);

    // Exercise block: ex, rest, ex = 3
    // Transition: rest = 1
    // Superset block (1 set, 2 exercises): A, rest, B = 3
    // + complete = 8
    expect(steps).toHaveLength(8);
    expect(steps[7].type).toBe('complete');

    // Verify blockIndex is correct
    expect(steps[0].blockIndex).toBe(0);
    expect(steps[2].blockIndex).toBe(0);
    expect(steps[4].blockIndex).toBe(1);
    expect(steps[6].blockIndex).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// countExerciseSteps
// ---------------------------------------------------------------------------

describe('countExerciseSteps', () => {
  it('counts only exercise steps, not rests or complete', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 3 })];
    const steps = generateSteps(blocks, null, 90, 30);
    expect(countExerciseSteps(steps)).toBe(3);
  });

  it('counts exercise steps from superset blocks', () => {
    const blocks: TemplateBlock[] = [makeSupersetBlock({ sets: 2 })];
    const steps = generateSteps(blocks, null, 90, 30);
    // 2 exercises * 2 sets = 4 exercise steps
    expect(countExerciseSteps(steps)).toBe(4);
  });

  it('returns 0 for an empty steps array', () => {
    expect(countExerciseSteps([])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getExerciseStepAt
// ---------------------------------------------------------------------------

describe('getExerciseStepAt', () => {
  it('returns the exercise step at a valid exercise index', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 3 })];
    const steps = generateSteps(blocks, null, 90, 30);

    const step = getExerciseStepAt(steps, 0);
    expect(step).not.toBeNull();
    expect(step?.type).toBe('exercise');
    expect(step?.exerciseId).toBe('ex-bench');
  });

  it('returns null for a rest step index', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 3 })];
    const steps = generateSteps(blocks, null, 90, 30);

    // Index 1 is a rest step
    const step = getExerciseStepAt(steps, 1);
    expect(step).toBeNull();
  });

  it('returns null for an out-of-bounds index', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 1 })];
    const steps = generateSteps(blocks, null, 90, 30);

    expect(getExerciseStepAt(steps, 100)).toBeNull();
  });

  it('returns null for a negative index', () => {
    const blocks: TemplateBlock[] = [makeExerciseBlock({ sets: 1 })];
    const steps = generateSteps(blocks, null, 90, 30);

    expect(getExerciseStepAt(steps, -1)).toBeNull();
  });
});
