import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExerciseHistoryEntry, PerformedSet, WorkoutLog } from '@/types/workout';

// ---------------------------------------------------------------------------
// Mock the Dexie database (vi.hoisted to avoid TDZ with vi.mock factory)
// ---------------------------------------------------------------------------

const { mockExerciseHistory } = vi.hoisted(() => ({
  mockExerciseHistory: {
    where: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    exerciseHistory: mockExerciseHistory,
  },
}));

import { detectPersonalRecords } from '../personalRecords';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePerformedSet(
  exerciseId: string,
  weightG: number,
  repsDone: number,
  exerciseName = 'Bench Press',
): PerformedSet {
  return {
    exerciseId,
    exerciseNameSnapshot: exerciseName,
    blockPath: 'block-0',
    setIndex: 0,
    repsTargetMin: 8,
    repsTargetMax: 12,
    repsDone,
    weightG,
  };
}

function makeLog(overrides: Partial<WorkoutLog> = {}): WorkoutLog {
  return {
    id: 'log-1',
    status: 'completed',
    templateId: 't-1',
    templateName: 'Push Day',
    templateSnapshot: [],
    performedSets: [],
    startedAt: '2025-06-01T10:00:00Z',
    endedAt: '2025-06-01T11:00:00Z',
    durationSec: 3600,
    totalVolumeG: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// detectPersonalRecords
// ---------------------------------------------------------------------------

describe('detectPersonalRecords', () => {
  it('returns empty arrays when the log has no performed sets', async () => {
    const log = makeLog({ performedSets: [] });
    const result = await detectPersonalRecords(log);
    expect(result).toEqual({ oneRm: [], volume: [] });
    expect(mockExerciseHistory.where).not.toHaveBeenCalled();
  });

  it('does not award a PR when there is no previous best (> 0)', async () => {
    mockExerciseHistory.where.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        each: vi.fn().mockResolvedValue(undefined),
      }),
    });

    const log = makeLog({
      id: 'log-new',
      performedSets: [makePerformedSet('ex-bench', 100000, 5)],
    });

    const result = await detectPersonalRecords(log);
    expect(result.oneRm).toEqual([]);
    expect(result.volume).toEqual([]);
  });

  it('awards a 1RM PR when current best beats the previous best', async () => {
    const historyRows: ExerciseHistoryEntry[] = [
      {
        logId: 'log-old',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        performedAt: '2025-05-01T10:00:00Z',
        bestWeightG: 90000,
        totalVolumeG: 400000,
        totalSets: 3,
        totalReps: 15,
        estimated1RM_G: 110000,
      },
    ];

    mockExerciseHistory.where.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        each: vi.fn().mockImplementation(async (cb: (row: ExerciseHistoryEntry) => void) => {
          for (const row of historyRows) cb(row);
        }),
      }),
    });

    const log = makeLog({
      id: 'log-new',
      performedSets: [makePerformedSet('ex-bench', 100000, 5)],
    });

    const result = await detectPersonalRecords(log);
    expect(result.oneRm).toEqual([{ exerciseId: 'ex-bench', name: 'Bench Press' }]);
  });

  it('awards a volume PR when current volume beats the previous best', async () => {
    const historyRows: ExerciseHistoryEntry[] = [
      {
        logId: 'log-old',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        performedAt: '2025-05-01T10:00:00Z',
        bestWeightG: 90000,
        totalVolumeG: 500000,
        totalSets: 3,
        totalReps: 15,
        estimated1RM_G: null,
      },
    ];

    mockExerciseHistory.where.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        each: vi.fn().mockImplementation(async (cb: (row: ExerciseHistoryEntry) => void) => {
          for (const row of historyRows) cb(row);
        }),
      }),
    });

    const log = makeLog({
      id: 'log-new',
      performedSets: [
        makePerformedSet('ex-bench', 100000, 10),
        makePerformedSet('ex-bench', 100000, 10),
        makePerformedSet('ex-bench', 100000, 10),
      ],
    });

    const result = await detectPersonalRecords(log);
    expect(result.volume).toEqual([{ exerciseId: 'ex-bench', name: 'Bench Press' }]);
  });

  it('ignores history entries from the current log id', async () => {
    const historyRows: ExerciseHistoryEntry[] = [
      {
        logId: 'log-new',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        performedAt: '2025-06-01T10:00:00Z',
        bestWeightG: 200000,
        totalVolumeG: 9_999_999,
        totalSets: 10,
        totalReps: 50,
        estimated1RM_G: 300000,
      },
    ];

    mockExerciseHistory.where.mockReturnValue({
      anyOf: vi.fn().mockReturnValue({
        each: vi.fn().mockImplementation(async (cb: (row: ExerciseHistoryEntry) => void) => {
          for (const row of historyRows) cb(row);
        }),
      }),
    });

    const log = makeLog({
      id: 'log-new',
      performedSets: [makePerformedSet('ex-bench', 100000, 5)],
    });

    const result = await detectPersonalRecords(log);
    // Only "current log" history existed, so previous best remains 0 -> no PRs.
    expect(result).toEqual({ oneRm: [], volume: [] });
  });
});

