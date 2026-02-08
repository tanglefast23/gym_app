import { describe, it, expect } from 'vitest';
import {
  sanitizeText,
  validateWorkoutName,
  validateExerciseName,
  validateNotes,
  validateSets,
  validateRepRange,
  validateRestTime,
  validateWeightG,
  validateBlock,
  validateTemplate,
  validateImportData,
  validateImportExercise,
  validateImportTemplate,
  validateImportLog,
  validateImportSettings,
} from '../validation';
import { VALIDATION } from '@/types/workout';
import type { ExerciseBlock, SupersetBlock } from '@/types/workout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidExerciseBlock(
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
    ...overrides,
  };
}

function makeValidSupersetBlock(
  overrides: Partial<SupersetBlock> = {},
): SupersetBlock {
  return {
    id: 'sb-1',
    type: 'superset',
    sets: 3,
    exercises: [
      { exerciseId: 'ex-a', repsMin: 8, repsMax: 10 },
      { exerciseId: 'ex-b', repsMin: 10, repsMax: 12 },
    ],
    restBetweenExercisesSec: 30,
    restBetweenSupersetsSec: 120,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sanitizeText
// ---------------------------------------------------------------------------

describe('sanitizeText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(sanitizeText('  hello  ')).toBe('hello');
  });

  it('collapses multiple spaces into one', () => {
    expect(sanitizeText('hello   world')).toBe('hello world');
  });

  it('strips control characters', () => {
    expect(sanitizeText('hello\x00world\x1F')).toBe('helloworld');
  });

  it('handles a combination of issues', () => {
    expect(sanitizeText('  hello\x00  \n  world  ')).toBe('hello world');
  });

  it('returns empty string for whitespace-only input', () => {
    expect(sanitizeText('   ')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// validateWorkoutName
// ---------------------------------------------------------------------------

describe('validateWorkoutName', () => {
  it('returns error for empty string', () => {
    expect(validateWorkoutName('')).toBe('Workout name is required');
  });

  it('returns error for whitespace-only string', () => {
    expect(validateWorkoutName('   ')).toBe('Workout name is required');
  });

  it('returns null for a valid name', () => {
    expect(validateWorkoutName('Push Day')).toBeNull();
  });

  it('returns error when name exceeds max length', () => {
    const longName = 'A'.repeat(VALIDATION.WORKOUT_NAME_MAX + 1);
    expect(validateWorkoutName(longName)).toContain('chars or less');
  });

  it('returns null at exactly max length', () => {
    const exactName = 'A'.repeat(VALIDATION.WORKOUT_NAME_MAX);
    expect(validateWorkoutName(exactName)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateExerciseName
// ---------------------------------------------------------------------------

describe('validateExerciseName', () => {
  it('returns error for empty string', () => {
    expect(validateExerciseName('')).toBe('Exercise name is required');
  });

  it('returns null for a valid name', () => {
    expect(validateExerciseName('Bench Press')).toBeNull();
  });

  it('returns error when name exceeds max length', () => {
    const longName = 'B'.repeat(VALIDATION.EXERCISE_NAME_MAX + 1);
    expect(validateExerciseName(longName)).toContain('chars or less');
  });
});

// ---------------------------------------------------------------------------
// validateNotes
// ---------------------------------------------------------------------------

describe('validateNotes', () => {
  it('returns null for notes within limit', () => {
    expect(validateNotes('Great workout today')).toBeNull();
  });

  it('returns error for notes over the limit', () => {
    const longNotes = 'X'.repeat(VALIDATION.NOTES_MAX + 1);
    expect(validateNotes(longNotes)).toContain('chars or less');
  });

  it('returns null for empty notes', () => {
    expect(validateNotes('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// validateSets
// ---------------------------------------------------------------------------

describe('validateSets', () => {
  it('returns error for 0 sets', () => {
    expect(validateSets(0)).toContain('at least 1');
  });

  it('returns null for 1 set', () => {
    expect(validateSets(1)).toBeNull();
  });

  it('returns null for max sets', () => {
    expect(validateSets(VALIDATION.MAX_SETS)).toBeNull();
  });

  it('returns error when exceeding max sets', () => {
    expect(validateSets(VALIDATION.MAX_SETS + 1)).toContain('Maximum');
  });

  it('returns error for non-integer', () => {
    expect(validateSets(2.5)).toContain('at least 1');
  });

  it('returns error for negative number', () => {
    expect(validateSets(-1)).toContain('at least 1');
  });
});

// ---------------------------------------------------------------------------
// validateRepRange
// ---------------------------------------------------------------------------

describe('validateRepRange', () => {
  it('returns null for valid range', () => {
    expect(validateRepRange(1, 10)).toBeNull();
  });

  it('returns null when min equals max', () => {
    expect(validateRepRange(10, 10)).toBeNull();
  });

  it('returns error when min < 1', () => {
    expect(validateRepRange(0, 10)).toContain('at least 1');
  });

  it('returns error when min > max', () => {
    expect(validateRepRange(10, 5)).toContain('cannot exceed');
  });

  it('returns error when max exceeds limit', () => {
    expect(validateRepRange(1, VALIDATION.MAX_REPS + 1)).toContain('Maximum');
  });

  it('returns error for non-integer values', () => {
    expect(validateRepRange(1.5, 10)).toContain('whole numbers');
  });
});

// ---------------------------------------------------------------------------
// validateRestTime
// ---------------------------------------------------------------------------

describe('validateRestTime', () => {
  it('returns error when below minimum', () => {
    expect(validateRestTime(VALIDATION.MIN_REST_SEC - 1)).toContain('Minimum');
  });

  it('returns null at exact minimum', () => {
    expect(validateRestTime(VALIDATION.MIN_REST_SEC)).toBeNull();
  });

  it('returns null at exact maximum', () => {
    expect(validateRestTime(VALIDATION.MAX_REST_SEC)).toBeNull();
  });

  it('returns error when above maximum', () => {
    expect(validateRestTime(VALIDATION.MAX_REST_SEC + 1)).toContain('Maximum');
  });

  it('returns error for non-integer', () => {
    expect(validateRestTime(30.5)).toContain('whole number');
  });
});

// ---------------------------------------------------------------------------
// validateWeightG
// ---------------------------------------------------------------------------

describe('validateWeightG', () => {
  it('returns error for negative weight', () => {
    expect(validateWeightG(-1)).toContain('negative');
  });

  it('returns null for 0g', () => {
    expect(validateWeightG(0)).toBeNull();
  });

  it('returns null for max weight', () => {
    expect(validateWeightG(VALIDATION.MAX_WEIGHT_G)).toBeNull();
  });

  it('returns error when exceeding max weight', () => {
    expect(validateWeightG(VALIDATION.MAX_WEIGHT_G + 1)).toContain('exceeds');
  });

  it('returns error for non-integer grams', () => {
    expect(validateWeightG(100.5)).toContain('integer grams');
  });
});

// ---------------------------------------------------------------------------
// validateBlock - exercise
// ---------------------------------------------------------------------------

describe('validateBlock (exercise)', () => {
  it('returns empty errors for a valid exercise block', () => {
    const errors = validateBlock(makeValidExerciseBlock());
    expect(errors).toEqual([]);
  });

  it('returns error when exerciseId is empty', () => {
    const errors = validateBlock(
      makeValidExerciseBlock({ exerciseId: '' }),
    );
    expect(errors).toContain('Exercise is required');
  });

  it('returns error for invalid sets', () => {
    const errors = validateBlock(makeValidExerciseBlock({ sets: 0 }));
    expect(errors.some((e) => e.includes('at least 1'))).toBe(true);
  });

  it('returns error for invalid rep range', () => {
    const errors = validateBlock(
      makeValidExerciseBlock({ repsMin: 10, repsMax: 5 }),
    );
    expect(errors.some((e) => e.includes('cannot exceed'))).toBe(true);
  });

  it('validates block-level rest if provided', () => {
    const errors = validateBlock(
      makeValidExerciseBlock({ restBetweenSetsSec: 2 }),
    );
    expect(errors.some((e) => e.includes('Minimum'))).toBe(true);
  });

  it('skips rest validation when rest is null', () => {
    const errors = validateBlock(
      makeValidExerciseBlock({ restBetweenSetsSec: null }),
    );
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateBlock - superset
// ---------------------------------------------------------------------------

describe('validateBlock (superset)', () => {
  it('returns empty errors for a valid superset block', () => {
    const errors = validateBlock(makeValidSupersetBlock());
    expect(errors).toEqual([]);
  });

  it('returns error when fewer than 2 exercises', () => {
    const errors = validateBlock(
      makeValidSupersetBlock({
        exercises: [{ exerciseId: 'ex-a', repsMin: 8, repsMax: 10 }],
      }),
    );
    expect(errors).toContain('Superset must have at least 2 exercises');
  });

  it('returns error when a superset exercise is missing exerciseId', () => {
    const errors = validateBlock(
      makeValidSupersetBlock({
        exercises: [
          { exerciseId: '', repsMin: 8, repsMax: 10 },
          { exerciseId: 'ex-b', repsMin: 10, repsMax: 12 },
        ],
      }),
    );
    expect(errors).toContain('All superset exercises require a name');
  });

  it('validates rest between exercises', () => {
    const errors = validateBlock(
      makeValidSupersetBlock({ restBetweenExercisesSec: 2 }),
    );
    expect(errors.some((e) => e.includes('Rest between exercises'))).toBe(true);
  });

  it('validates rest between supersets', () => {
    const errors = validateBlock(
      makeValidSupersetBlock({ restBetweenSupersetsSec: 9999 }),
    );
    expect(errors.some((e) => e.includes('Rest between supersets'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateTemplate
// ---------------------------------------------------------------------------

describe('validateTemplate', () => {
  it('returns error for empty name', () => {
    const errors = validateTemplate('', [makeValidExerciseBlock()]);
    expect(errors.some((e) => e.includes('required'))).toBe(true);
  });

  it('returns error for empty blocks array', () => {
    const errors = validateTemplate('Push Day', []);
    expect(errors).toContain('At least one exercise block is required');
  });

  it('returns empty errors for a fully valid template', () => {
    const errors = validateTemplate('Push Day', [makeValidExerciseBlock()]);
    expect(errors).toEqual([]);
  });

  it('prefixes block errors with block number', () => {
    const errors = validateTemplate('Push Day', [
      makeValidExerciseBlock({ exerciseId: '' }),
    ]);
    expect(errors.some((e) => e.startsWith('Block 1:'))).toBe(true);
  });

  it('collects errors from multiple blocks', () => {
    const errors = validateTemplate('Push Day', [
      makeValidExerciseBlock({ exerciseId: '' }),
      makeValidExerciseBlock({ sets: 0 }),
    ]);
    const block1Errors = errors.filter((e) => e.startsWith('Block 1:'));
    const block2Errors = errors.filter((e) => e.startsWith('Block 2:'));
    expect(block1Errors.length).toBeGreaterThan(0);
    expect(block2Errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// validateImportData
// ---------------------------------------------------------------------------

describe('validateImportData', () => {
  it('returns invalid for non-object input', () => {
    const result = validateImportData('not an object');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid data format');
  });

  it('returns invalid for null', () => {
    const result = validateImportData(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid data format');
  });

  it('returns errors for missing fields', () => {
    const result = validateImportData({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unsupported schema version');
    expect(result.errors).toContain('Missing export timestamp');
    expect(result.errors).toContain('Missing exercises array');
    expect(result.errors).toContain('Missing templates array');
    expect(result.errors).toContain('Missing logs array');
    expect(result.errors).toContain('Missing exercise history array');
    expect(result.errors).toContain('Missing achievements array');
  });

  it('returns error for wrong schema version', () => {
    const result = validateImportData({
      schemaVersion: 2,
      exportedAt: '2025-01-01',
      exercises: [],
      templates: [],
      logs: [],
      exerciseHistory: [],
      achievements: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Unsupported schema version');
  });

  it('returns valid for correct data structure', () => {
    const result = validateImportData({
      schemaVersion: 1,
      exportedAt: '2025-01-01T00:00:00Z',
      exercises: [],
      templates: [],
      logs: [],
      exerciseHistory: [],
      achievements: [],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns error when arrays are not actually arrays', () => {
    const result = validateImportData({
      schemaVersion: 1,
      exportedAt: '2025-01-01',
      exercises: 'not-array',
      templates: {},
      logs: [],
      exerciseHistory: [],
      achievements: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing exercises array');
    expect(result.errors).toContain('Missing templates array');
  });

  it('rejects import with an invalid exercise record', () => {
    const result = validateImportData({
      schemaVersion: 1,
      exportedAt: '2025-01-01T00:00:00Z',
      exercises: [{ id: '', name: 'Bench Press' }],
      templates: [],
      logs: [],
      exerciseHistory: [],
      achievements: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exercises[0]'))).toBe(true);
  });

  it('rejects import with an invalid log record', () => {
    const result = validateImportData({
      schemaVersion: 1,
      exportedAt: '2025-01-01T00:00:00Z',
      exercises: [],
      templates: [],
      logs: [{ id: 'log-1', startedAt: 'not-a-date', status: 'completed' }],
      exerciseHistory: [],
      achievements: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('logs[0]'))).toBe(true);
  });

  it('rejects import with invalid settings', () => {
    const result = validateImportData({
      schemaVersion: 1,
      exportedAt: '2025-01-01T00:00:00Z',
      exercises: [],
      templates: [],
      logs: [],
      exerciseHistory: [],
      achievements: [],
      settings: { unitSystem: 'stone', defaultRestBetweenSetsSec: -5 },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('unitSystem'))).toBe(true);
    expect(result.errors.some((e) => e.includes('defaultRestBetweenSetsSec'))).toBe(true);
  });

  it('passes with valid per-record data', () => {
    const result = validateImportData({
      schemaVersion: 1,
      exportedAt: '2025-01-01T00:00:00Z',
      exercises: [
        { id: 'ex-1', name: 'Bench Press', visualKey: 'bench', createdAt: '2025-01-01', updatedAt: '2025-01-01' },
      ],
      templates: [
        { id: 't-1', name: 'Push Day', blocks: [], defaultRestBetweenSetsSec: null, createdAt: '2025-01-01', updatedAt: '2025-01-01', isArchived: false },
      ],
      logs: [
        { id: 'l-1', startedAt: '2025-01-01T10:00:00Z', status: 'completed', templateId: 't-1', templateName: 'Push Day', templateSnapshot: [], performedSets: [], endedAt: '2025-01-01T11:00:00Z', durationSec: 3600, totalVolumeG: 0 },
      ],
      exerciseHistory: [],
      achievements: [],
      settings: { id: 'settings', unitSystem: 'kg', defaultRestBetweenSetsSec: 90, weightStepsKg: [1, 2.5, 5], weightStepsLb: [2.5, 5, 10], hapticFeedback: true, soundEnabled: true, restTimerSound: true, theme: 'dark' },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateImportExercise
// ---------------------------------------------------------------------------

describe('validateImportExercise', () => {
  it('returns empty errors for a valid exercise', () => {
    const errors = validateImportExercise(
      {
        id: 'ex-1',
        name: 'Bench Press',
        visualKey: 'default',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
      0,
    );
    expect(errors).toEqual([]);
  });

  it('returns error for non-object', () => {
    const errors = validateImportExercise('not-an-object', 0);
    expect(errors).toEqual(['exercises[0]: must be an object']);
  });

  it('returns error for null', () => {
    const errors = validateImportExercise(null, 3);
    expect(errors).toEqual(['exercises[3]: must be an object']);
  });

  it('returns error for empty id', () => {
    const errors = validateImportExercise({ id: '', name: 'Valid' }, 0);
    expect(errors.some((e) => e.includes('"id"'))).toBe(true);
  });

  it('returns error for missing name', () => {
    const errors = validateImportExercise({ id: 'ex-1' }, 0);
    expect(errors.some((e) => e.includes('"name"'))).toBe(true);
  });

  it('returns error for name exceeding max length', () => {
    const errors = validateImportExercise(
      { id: 'ex-1', name: 'X'.repeat(VALIDATION.EXERCISE_NAME_MAX + 1) },
      0,
    );
    expect(errors.some((e) => e.includes('"name"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateImportTemplate
// ---------------------------------------------------------------------------

describe('validateImportTemplate', () => {
  it('returns empty errors for a valid template', () => {
    const errors = validateImportTemplate(
      {
        id: 't-1',
        name: 'Push Day',
        blocks: [],
        defaultRestBetweenSetsSec: null,
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        isArchived: false,
      },
      0,
    );
    expect(errors).toEqual([]);
  });

  it('returns error for non-object', () => {
    const errors = validateImportTemplate(42, 1);
    expect(errors).toEqual(['templates[1]: must be an object']);
  });

  it('returns error for missing blocks array', () => {
    const errors = validateImportTemplate(
      { id: 't-1', name: 'Push Day' },
      0,
    );
    expect(errors.some((e) => e.includes('.blocks'))).toBe(true);
  });

  it('returns error for name exceeding max length', () => {
    const errors = validateImportTemplate(
      { id: 't-1', name: 'A'.repeat(VALIDATION.WORKOUT_NAME_MAX + 1), blocks: [] },
      0,
    );
    expect(errors.some((e) => e.includes('"name"'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateImportLog
// ---------------------------------------------------------------------------

describe('validateImportLog', () => {
  it('returns empty errors for a valid log', () => {
    const errors = validateImportLog(
      {
        id: 'l-1',
        startedAt: '2025-01-01T10:00:00Z',
        status: 'completed',
        templateId: 't-1',
        templateName: 'Push Day',
        templateSnapshot: [],
        performedSets: [],
        endedAt: '2025-01-01T11:00:00Z',
        durationSec: 3600,
        totalVolumeG: 0,
      },
      0,
    );
    expect(errors).toEqual([]);
  });

  it('returns error for non-object', () => {
    const errors = validateImportLog(null, 0);
    expect(errors).toEqual(['logs[0]: must be an object']);
  });

  it('returns error for invalid startedAt date', () => {
    const errors = validateImportLog(
      { id: 'l-1', startedAt: 'not-a-date', status: 'completed' },
      0,
    );
    expect(errors.some((e) => e.includes('"startedAt"'))).toBe(true);
  });

  it('returns error for invalid status', () => {
    const errors = validateImportLog(
      { id: 'l-1', startedAt: '2025-01-01T10:00:00Z', status: 'unknown' },
      0,
    );
    expect(errors.some((e) => e.includes('"status"'))).toBe(true);
  });

  it('accepts "partial" as valid status', () => {
    const errors = validateImportLog(
      {
        id: 'l-1',
        startedAt: '2025-01-01T10:00:00Z',
        status: 'partial',
        templateId: 't-1',
        templateName: 'Push Day',
        templateSnapshot: [],
        performedSets: [],
        endedAt: '2025-01-01T11:00:00Z',
        durationSec: 3600,
        totalVolumeG: 0,
      },
      0,
    );
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateImportSettings
// ---------------------------------------------------------------------------

describe('validateImportSettings', () => {
  it('returns empty errors for valid settings', () => {
    const errors = validateImportSettings({
      unitSystem: 'kg',
      defaultRestBetweenSetsSec: 90,
    });
    expect(errors).toEqual([]);
  });

  it('returns error for non-object', () => {
    const errors = validateImportSettings('invalid');
    expect(errors).toEqual(['settings: must be an object']);
  });

  it('returns error for invalid unitSystem', () => {
    const errors = validateImportSettings({
      unitSystem: 'stone',
      defaultRestBetweenSetsSec: 90,
    });
    expect(errors.some((e) => e.includes('"unitSystem"'))).toBe(true);
  });

  it('returns error for non-positive defaultRestBetweenSetsSec', () => {
    const errors = validateImportSettings({
      unitSystem: 'lb',
      defaultRestBetweenSetsSec: 0,
    });
    expect(errors.some((e) => e.includes('"defaultRestBetweenSetsSec"'))).toBe(true);
  });

  it('returns error for non-number defaultRestBetweenSetsSec', () => {
    const errors = validateImportSettings({
      unitSystem: 'lb',
      defaultRestBetweenSetsSec: 'ninety',
    });
    expect(errors.some((e) => e.includes('"defaultRestBetweenSetsSec"'))).toBe(true);
  });

  it('accepts lb as valid unitSystem', () => {
    const errors = validateImportSettings({
      unitSystem: 'lb',
      defaultRestBetweenSetsSec: 60,
    });
    expect(errors).toEqual([]);
  });
});
