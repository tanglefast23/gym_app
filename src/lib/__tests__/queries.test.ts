import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkoutLog, ExerciseHistoryEntry, PerformedSet } from '@/types/workout';

// ---------------------------------------------------------------------------
// Mock the Dexie database (vi.hoisted to avoid TDZ with vi.mock factory)
// ---------------------------------------------------------------------------

const {
  mockExercises,
  mockTemplates,
  mockLogs,
  mockExerciseHistory,
  mockAchievements,
  mockBodyWeights,
  mockCrashRecovery,
  mockTransaction,
} = vi.hoisted(() => ({
  mockExercises: {
    count: vi.fn(),
    clear: vi.fn(),
  },
  mockTemplates: {
    count: vi.fn(),
    clear: vi.fn(),
  },
  mockLogs: {
    count: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    clear: vi.fn(),
    where: vi.fn(),
    bulkDelete: vi.fn(),
  },
  mockExerciseHistory: {
    count: vi.fn(),
    bulkAdd: vi.fn(),
    bulkDelete: vi.fn(),
    clear: vi.fn(),
    where: vi.fn(),
  },
  mockAchievements: {
    count: vi.fn(),
    clear: vi.fn(),
  },
  mockBodyWeights: {
    count: vi.fn(),
    clear: vi.fn(),
  },
  mockCrashRecovery: {
    clear: vi.fn(),
  },
  mockTransaction: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    exercises: mockExercises,
    templates: mockTemplates,
    logs: mockLogs,
    exerciseHistory: mockExerciseHistory,
    achievements: mockAchievements,
    bodyWeights: mockBodyWeights,
    crashRecovery: mockCrashRecovery,
    transaction: mockTransaction,
  },
}));

import {
  writeExerciseHistory,
  getLastPerformedSets,
  deleteLog,
  getDataCounts,
  deleteAllData,
  deleteDataByDateRange,
} from '../queries';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePerformedSet(
  exerciseId: string,
  weightG: number,
  repsDone: number,
  exerciseName = 'Bench Press',
  setIndex = 0,
): PerformedSet {
  return {
    exerciseId,
    exerciseNameSnapshot: exerciseName,
    blockPath: 'block-0',
    setIndex,
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
// writeExerciseHistory
// ---------------------------------------------------------------------------

describe('writeExerciseHistory', () => {
  it('creates one history entry per exercise', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      performedSets: [
        makePerformedSet('ex-bench', 100000, 8, 'Bench Press', 0),
        makePerformedSet('ex-bench', 100000, 6, 'Bench Press', 1),
        makePerformedSet('ex-squat', 140000, 5, 'Squat', 0),
      ],
    });

    await writeExerciseHistory(log);

    expect(mockExerciseHistory.bulkAdd).toHaveBeenCalledOnce();
    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    expect(entries).toHaveLength(2);
  });

  it('calculates correct total volume per exercise', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      performedSets: [
        makePerformedSet('ex-bench', 100000, 10, 'Bench Press', 0),
        makePerformedSet('ex-bench', 100000, 8, 'Bench Press', 1),
      ],
    });

    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    const benchEntry = entries.find((e) => e.exerciseId === 'ex-bench')!;
    // Volume = 100000 * 10 + 100000 * 8 = 1_800_000
    expect(benchEntry.totalVolumeG).toBe(1_800_000);
  });

  it('calculates correct total reps and sets', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      performedSets: [
        makePerformedSet('ex-bench', 100000, 10, 'Bench Press', 0),
        makePerformedSet('ex-bench', 100000, 8, 'Bench Press', 1),
        makePerformedSet('ex-bench', 100000, 6, 'Bench Press', 2),
      ],
    });

    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    const benchEntry = entries.find((e) => e.exerciseId === 'ex-bench')!;
    expect(benchEntry.totalSets).toBe(3);
    expect(benchEntry.totalReps).toBe(24);
  });

  it('picks the best weight across sets', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      performedSets: [
        makePerformedSet('ex-bench', 90000, 10, 'Bench Press', 0),
        makePerformedSet('ex-bench', 100000, 8, 'Bench Press', 1),
        makePerformedSet('ex-bench', 95000, 6, 'Bench Press', 2),
      ],
    });

    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    const benchEntry = entries.find((e) => e.exerciseId === 'ex-bench')!;
    expect(benchEntry.bestWeightG).toBe(100000);
  });

  it('calculates estimated 1RM using Epley formula', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      performedSets: [
        makePerformedSet('ex-bench', 100000, 5, 'Bench Press', 0),
      ],
    });

    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    const benchEntry = entries.find((e) => e.exerciseId === 'ex-bench')!;
    // Epley: 100000 * (1 + 5/30) = 116667 (rounded)
    expect(benchEntry.estimated1RM_G).toBe(Math.round(100000 * (1 + 5 / 30)));
  });

  it('returns null 1RM when reps > 12', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      performedSets: [
        makePerformedSet('ex-bench', 100000, 15, 'Bench Press', 0),
      ],
    });

    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    const benchEntry = entries.find((e) => e.exerciseId === 'ex-bench')!;
    expect(benchEntry.estimated1RM_G).toBeNull();
  });

  it('does nothing for a log with no sets', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({ performedSets: [] });
    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    expect(entries).toHaveLength(0);
  });

  it('uses the logId and startedAt from the log', async () => {
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);

    const log = makeLog({
      id: 'log-42',
      startedAt: '2025-07-01T15:00:00Z',
      performedSets: [makePerformedSet('ex-bench', 100000, 5, 'Bench Press', 0)],
    });

    await writeExerciseHistory(log);

    const entries = mockExerciseHistory.bulkAdd.mock.calls[0][0] as ExerciseHistoryEntry[];
    expect(entries[0].logId).toBe('log-42');
    expect(entries[0].performedAt).toBe('2025-07-01T15:00:00Z');
  });
});

// ---------------------------------------------------------------------------
// getLastPerformedSets
// ---------------------------------------------------------------------------

describe('getLastPerformedSets', () => {
  it('returns the performed sets from the most recent log', async () => {
    const expectedSets: PerformedSet[] = [
      makePerformedSet('ex-bench', 100000, 8, 'Bench Press', 0),
      makePerformedSet('ex-bench', 100000, 6, 'Bench Press', 1),
    ];

    mockExerciseHistory.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            logId: 'log-1',
            exerciseId: 'ex-bench',
          }),
        }),
      }),
    });

    mockLogs.get.mockResolvedValue(
      makeLog({
        id: 'log-1',
        performedSets: [
          ...expectedSets,
          makePerformedSet('ex-squat', 140000, 5, 'Squat', 0),
        ],
      }),
    );

    const result = await getLastPerformedSets('ex-bench');
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.exerciseId === 'ex-bench')).toBe(true);
  });

  it('returns empty array when no history exists', async () => {
    mockExerciseHistory.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue(undefined),
        }),
      }),
    });

    const result = await getLastPerformedSets('ex-nonexistent');
    expect(result).toEqual([]);
  });

  it('returns empty array when referenced log is missing', async () => {
    mockExerciseHistory.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        reverse: vi.fn().mockReturnValue({
          first: vi.fn().mockResolvedValue({
            logId: 'log-deleted',
            exerciseId: 'ex-bench',
          }),
        }),
      }),
    });

    mockLogs.get.mockResolvedValue(undefined);

    const result = await getLastPerformedSets('ex-bench');
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deleteLog
// ---------------------------------------------------------------------------

describe('deleteLog', () => {
  it('deletes the log and its associated history entries', async () => {
    const historyEntries: ExerciseHistoryEntry[] = [
      {
        id: 1,
        logId: 'log-1',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        performedAt: '2025-06-01T10:00:00Z',
        bestWeightG: 100000,
        totalVolumeG: 500000,
        totalSets: 3,
        totalReps: 24,
        estimated1RM_G: 116667,
      },
      {
        id: 2,
        logId: 'log-1',
        exerciseId: 'ex-squat',
        exerciseName: 'Squat',
        performedAt: '2025-06-01T10:00:00Z',
        bestWeightG: 140000,
        totalVolumeG: 700000,
        totalSets: 3,
        totalReps: 15,
        estimated1RM_G: 163333,
      },
    ];

    mockExerciseHistory.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(historyEntries),
      }),
    });
    mockLogs.delete.mockResolvedValue(undefined);
    mockExerciseHistory.bulkDelete.mockResolvedValue(undefined);

    await deleteLog('log-1');

    expect(mockLogs.delete).toHaveBeenCalledWith('log-1');
    expect(mockExerciseHistory.bulkDelete).toHaveBeenCalledWith([1, 2]);
  });

  it('skips bulkDelete when no history entries have ids', async () => {
    const historyEntries: ExerciseHistoryEntry[] = [
      {
        logId: 'log-1',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        performedAt: '2025-06-01T10:00:00Z',
        bestWeightG: 100000,
        totalVolumeG: 500000,
        totalSets: 3,
        totalReps: 24,
        estimated1RM_G: null,
        // no `id` field
      },
    ];

    mockExerciseHistory.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(historyEntries),
      }),
    });
    mockLogs.delete.mockResolvedValue(undefined);

    await deleteLog('log-1');

    expect(mockLogs.delete).toHaveBeenCalledWith('log-1');
    // bulkDelete should NOT be called since no IDs
    expect(mockExerciseHistory.bulkDelete).not.toHaveBeenCalled();
  });

  it('handles empty history for a log', async () => {
    mockExerciseHistory.where.mockReturnValue({
      equals: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });
    mockLogs.delete.mockResolvedValue(undefined);

    await deleteLog('log-1');

    expect(mockLogs.delete).toHaveBeenCalledWith('log-1');
    expect(mockExerciseHistory.bulkDelete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getDataCounts
// ---------------------------------------------------------------------------

describe('getDataCounts', () => {
  it('returns correct counts for all tables', async () => {
    mockExercises.count.mockResolvedValue(5);
    mockTemplates.count.mockResolvedValue(3);
    mockLogs.count.mockResolvedValue(20);
    mockExerciseHistory.count.mockResolvedValue(50);
    mockAchievements.count.mockResolvedValue(2);
    mockBodyWeights.count.mockResolvedValue(10);

    const counts = await getDataCounts();

    expect(counts).toEqual({
      exercises: 5,
      templates: 3,
      logs: 20,
      exerciseHistory: 50,
      achievements: 2,
      bodyWeights: 10,
    });
  });

  it('returns zeros when all tables are empty', async () => {
    mockExercises.count.mockResolvedValue(0);
    mockTemplates.count.mockResolvedValue(0);
    mockLogs.count.mockResolvedValue(0);
    mockExerciseHistory.count.mockResolvedValue(0);
    mockAchievements.count.mockResolvedValue(0);
    mockBodyWeights.count.mockResolvedValue(0);

    const counts = await getDataCounts();

    expect(counts).toEqual({
      exercises: 0,
      templates: 0,
      logs: 0,
      exerciseHistory: 0,
      achievements: 0,
      bodyWeights: 0,
    });
  });
});

// ---------------------------------------------------------------------------
// deleteAllData
// ---------------------------------------------------------------------------

describe('deleteAllData', () => {
  it('calls transaction and clears all tables', async () => {
    // The transaction mock should execute the callback immediately
    mockTransaction.mockImplementation(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => {
      await cb();
    });

    mockExercises.clear.mockResolvedValue(undefined);
    mockTemplates.clear.mockResolvedValue(undefined);
    mockLogs.clear.mockResolvedValue(undefined);
    mockExerciseHistory.clear.mockResolvedValue(undefined);
    mockAchievements.clear.mockResolvedValue(undefined);
    mockBodyWeights.clear.mockResolvedValue(undefined);
    mockCrashRecovery.clear.mockResolvedValue(undefined);

    await deleteAllData();

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockExercises.clear).toHaveBeenCalledOnce();
    expect(mockTemplates.clear).toHaveBeenCalledOnce();
    expect(mockLogs.clear).toHaveBeenCalledOnce();
    expect(mockExerciseHistory.clear).toHaveBeenCalledOnce();
    expect(mockAchievements.clear).toHaveBeenCalledOnce();
    expect(mockBodyWeights.clear).toHaveBeenCalledOnce();
    expect(mockCrashRecovery.clear).toHaveBeenCalledOnce();
  });

  it('wraps clears in a Dexie transaction with rw mode', async () => {
    mockTransaction.mockImplementation(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => {
      await cb();
    });

    mockExercises.clear.mockResolvedValue(undefined);
    mockTemplates.clear.mockResolvedValue(undefined);
    mockLogs.clear.mockResolvedValue(undefined);
    mockExerciseHistory.clear.mockResolvedValue(undefined);
    mockAchievements.clear.mockResolvedValue(undefined);
    mockBodyWeights.clear.mockResolvedValue(undefined);
    mockCrashRecovery.clear.mockResolvedValue(undefined);

    await deleteAllData();

    expect(mockTransaction.mock.calls[0][0]).toBe('rw');
  });
});

// ---------------------------------------------------------------------------
// deleteDataByDateRange
// ---------------------------------------------------------------------------

describe('deleteDataByDateRange', () => {
  it('deletes only logs and history within the date range', async () => {
    const logsInRange: WorkoutLog[] = [
      makeLog({ id: 'log-1', startedAt: '2025-06-01T10:00:00Z' }),
      makeLog({ id: 'log-2', startedAt: '2025-06-05T10:00:00Z' }),
    ];

    const historyInRange: ExerciseHistoryEntry[] = [
      {
        id: 10,
        logId: 'log-1',
        exerciseId: 'ex-bench',
        exerciseName: 'Bench Press',
        performedAt: '2025-06-01T10:00:00Z',
        bestWeightG: 100000,
        totalVolumeG: 500000,
        totalSets: 3,
        totalReps: 24,
        estimated1RM_G: 116667,
      },
      {
        id: 11,
        logId: 'log-2',
        exerciseId: 'ex-squat',
        exerciseName: 'Squat',
        performedAt: '2025-06-05T10:00:00Z',
        bestWeightG: 140000,
        totalVolumeG: 700000,
        totalSets: 3,
        totalReps: 15,
        estimated1RM_G: null,
      },
    ];

    mockLogs.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(logsInRange),
      }),
    });

    mockExerciseHistory.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue(historyInRange),
      }),
    });

    mockTransaction.mockImplementation(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => {
      await cb();
    });

    mockLogs.bulkDelete.mockResolvedValue(undefined);
    mockExerciseHistory.bulkDelete.mockResolvedValue(undefined);

    const result = await deleteDataByDateRange(
      '2025-06-01T00:00:00Z',
      '2025-06-07T00:00:00Z',
    );

    expect(result.deletedLogs).toBe(2);
    expect(result.deletedHistory).toBe(2);
    expect(mockLogs.bulkDelete).toHaveBeenCalledWith(['log-1', 'log-2']);
    expect(mockExerciseHistory.bulkDelete).toHaveBeenCalledWith([10, 11]);
  });

  it('returns zero counts when nothing is in range', async () => {
    mockLogs.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });

    mockExerciseHistory.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });

    mockTransaction.mockImplementation(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => {
      await cb();
    });

    mockLogs.bulkDelete.mockResolvedValue(undefined);
    mockExerciseHistory.bulkDelete.mockResolvedValue(undefined);

    const result = await deleteDataByDateRange(
      '2025-06-01T00:00:00Z',
      '2025-06-07T00:00:00Z',
    );

    expect(result.deletedLogs).toBe(0);
    expect(result.deletedHistory).toBe(0);
  });

  it('wraps deletion in a transaction', async () => {
    mockLogs.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });

    mockExerciseHistory.where.mockReturnValue({
      between: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([]),
      }),
    });

    mockTransaction.mockImplementation(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => {
      await cb();
    });

    mockLogs.bulkDelete.mockResolvedValue(undefined);
    mockExerciseHistory.bulkDelete.mockResolvedValue(undefined);

    await deleteDataByDateRange('2025-06-01T00:00:00Z', '2025-06-07T00:00:00Z');

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTransaction.mock.calls[0][0]).toBe('rw');
  });
});
