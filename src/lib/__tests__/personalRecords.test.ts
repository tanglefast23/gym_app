import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkoutLog, ExerciseHistoryEntry } from '@/types/workout';

// ---------------------------------------------------------------------------
// Mock Dexie — personalRecords.ts queries `db.exerciseHistory`
// ---------------------------------------------------------------------------

let mockHistoryData: ExerciseHistoryEntry[] = [];

vi.mock('@/lib/db', () => ({
  db: {
    exerciseHistory: {
      where: () => ({
        anyOf: () => ({
          toArray: () => Promise.resolve(mockHistoryData),
        }),
      }),
    },
  },
}));

// Import AFTER mock is set up
const { detectPersonalRecords } = await import('@/lib/personalRecords');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-current',
    status: 'completed',
    templateId: 'tpl-1',
    templateName: 'Test Workout',
    performedSets: [],
    startedAt: '2025-06-15T10:00:00.000Z',
    endedAt: '2025-06-15T11:00:00.000Z',
    durationSec: 3600,
    totalVolumeG: 0,
    ...overrides,
  };
}

function makeHistoryEntry(
  overrides: Partial<ExerciseHistoryEntry> = {},
): ExerciseHistoryEntry {
  return {
    id: 1,
    logId: 'log-old',
    exerciseId: 'ex-1',
    exerciseName: 'Bench Press',
    performedAt: '2025-06-01T10:00:00.000Z',
    bestWeightG: 80_000,
    totalVolumeG: 240_000,
    totalSets: 3,
    totalReps: 30,
    estimated1RM_G: 90_000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockHistoryData = [];
});

describe('detectPersonalRecords', () => {
  it('returns empty arrays when log has no sets', async () => {
    const result = await detectPersonalRecords(makeLog());
    expect(result).toEqual({ oneRm: [], volume: [] });
  });

  it('does not award PR when this is the first time the exercise is logged', async () => {
    // No prior history → prevBest is 0, so the condition `prevBest > 0` fails
    mockHistoryData = [];

    const log = makeLog({
      performedSets: [
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 0,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 10,
          weightG: 80_000,
        },
      ],
    });

    const result = await detectPersonalRecords(log);
    expect(result.oneRm).toHaveLength(0);
    expect(result.volume).toHaveLength(0);
  });

  it('detects a 1RM PR when current best exceeds previous', async () => {
    // Previous best 1RM: 90,000g
    mockHistoryData = [
      makeHistoryEntry({
        logId: 'log-old',
        exerciseId: 'ex-1',
        estimated1RM_G: 90_000,
        totalVolumeG: 200_000,
      }),
    ];

    // Current: 85kg × 8 reps → Epley = 85000 * (1 + 8/30) = 85000 * 1.2667 ≈ 107,667
    const log = makeLog({
      performedSets: [
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 0,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 8,
          weightG: 85_000,
        },
      ],
    });

    const result = await detectPersonalRecords(log);
    expect(result.oneRm).toHaveLength(1);
    expect(result.oneRm[0].exerciseId).toBe('ex-1');
    expect(result.oneRm[0].name).toBe('Bench Press');
  });

  it('detects a volume PR when current total exceeds previous', async () => {
    // Previous best volume: 200,000g (200kg total)
    mockHistoryData = [
      makeHistoryEntry({
        logId: 'log-old',
        exerciseId: 'ex-1',
        estimated1RM_G: 200_000, // Very high so 1RM won't be a PR
        totalVolumeG: 200_000,
      }),
    ];

    // Current: 3 sets of 10 × 80kg = 80000 * 10 * 3 = 2,400,000g volume
    const log = makeLog({
      performedSets: [
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 0,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 10,
          weightG: 80_000,
        },
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 1,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 10,
          weightG: 80_000,
        },
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 2,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 10,
          weightG: 80_000,
        },
      ],
    });

    const result = await detectPersonalRecords(log);
    expect(result.volume).toHaveLength(1);
    expect(result.volume[0].exerciseId).toBe('ex-1');
  });

  it('does not count the current log entry in history comparison', async () => {
    // History contains an entry from the SAME log — should be excluded
    mockHistoryData = [
      makeHistoryEntry({
        logId: 'log-current', // same logId as the current log
        exerciseId: 'ex-1',
        estimated1RM_G: 999_999,
        totalVolumeG: 999_999,
      }),
    ];

    const log = makeLog({
      id: 'log-current',
      performedSets: [
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 0,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 10,
          weightG: 80_000,
        },
      ],
    });

    // Since the only history entry has the same logId, prevBest = 0, so no PR
    const result = await detectPersonalRecords(log);
    expect(result.oneRm).toHaveLength(0);
    expect(result.volume).toHaveLength(0);
  });

  it('handles multiple exercises independently', async () => {
    mockHistoryData = [
      makeHistoryEntry({
        logId: 'log-old',
        exerciseId: 'ex-1',
        estimated1RM_G: 80_000,
        totalVolumeG: 100_000,
      }),
      makeHistoryEntry({
        id: 2,
        logId: 'log-old',
        exerciseId: 'ex-2',
        exerciseName: 'Squat',
        estimated1RM_G: 120_000,
        totalVolumeG: 300_000,
      }),
    ];

    const log = makeLog({
      performedSets: [
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 0,
          repsTargetMin: 8,
          repsTargetMax: 12,
          repsDone: 5,
          weightG: 100_000, // Epley: 100000 * (1 + 5/30) = 116667, > 80000 → 1RM PR
        },
        {
          exerciseId: 'ex-2',
          exerciseNameSnapshot: 'Squat',
          blockPath: 'b1',
          setIndex: 0,
          repsTargetMin: 5,
          repsTargetMax: 5,
          repsDone: 3,
          weightG: 100_000, // Epley: 100000 * (1 + 3/30) = 110000, < 120000 → no 1RM PR
        },
      ],
    });

    const result = await detectPersonalRecords(log);
    // Only ex-1 has a 1RM PR
    expect(result.oneRm).toHaveLength(1);
    expect(result.oneRm[0].exerciseId).toBe('ex-1');
  });

  it('ignores 1RM for sets with reps > 12 (Epley returns null)', async () => {
    mockHistoryData = [
      makeHistoryEntry({
        logId: 'log-old',
        exerciseId: 'ex-1',
        estimated1RM_G: 50_000,
        totalVolumeG: 100_000,
      }),
    ];

    const log = makeLog({
      performedSets: [
        {
          exerciseId: 'ex-1',
          exerciseNameSnapshot: 'Bench Press',
          blockPath: 'b0',
          setIndex: 0,
          repsTargetMin: 15,
          repsTargetMax: 20,
          repsDone: 15, // > 12, Epley returns null
          weightG: 60_000,
        },
      ],
    });

    const result = await detectPersonalRecords(log);
    expect(result.oneRm).toHaveLength(0);
    // Volume: 60000 * 15 = 900,000 > 100,000 → volume PR
    expect(result.volume).toHaveLength(1);
  });
});
