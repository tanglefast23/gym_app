import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { WorkoutLog, UnlockedAchievement, ExerciseHistoryEntry } from '@/types/workout';

// ---------------------------------------------------------------------------
// Mock the Dexie database (vi.hoisted to avoid TDZ with vi.mock factory)
// ---------------------------------------------------------------------------

const {
  mockLogs,
  mockExerciseHistory,
  mockAchievements,
} = vi.hoisted(() => {
  const mockLogs = {
    count: vi.fn(),
    where: vi.fn(),
  };

  const mockExerciseHistory = {
    where: vi.fn(),
  };

  const mockAchievements = {
    toArray: vi.fn(),
    put: vi.fn(),
    orderBy: vi.fn(),
  };

  return { mockLogs, mockExerciseHistory, mockAchievements };
});

vi.mock('@/lib/db', () => ({
  db: {
    logs: mockLogs,
    exerciseHistory: mockExerciseHistory,
    achievements: mockAchievements,
  },
}));

import { ACHIEVEMENTS, checkAchievements, getUnlockedAchievements } from '../achievements';

// ---------------------------------------------------------------------------
// Types matching the internal PrefetchedData interface
// ---------------------------------------------------------------------------

interface PrefetchedData {
  totalLogs: number;
  recentLogsCount: number;
  exerciseHistoryByExercise: Map<string, ExerciseHistoryEntry[]>;
  existingAchievementIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function makePerformedSet(
  exerciseId: string,
  weightG: number,
  repsDone: number,
  exerciseName = 'Bench Press',
) {
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

function makeData(overrides: Partial<PrefetchedData> = {}): PrefetchedData {
  return {
    totalLogs: 0,
    recentLogsCount: 0,
    exerciseHistoryByExercise: new Map(),
    existingAchievementIds: new Set(),
    ...overrides,
  };
}

/** Helper: set up mock DB for checkAchievements to call prefetchAchievementData. */
function mockPrefetchData(opts: {
  totalLogs?: number;
  recentLogsCount?: number;
  historyRows?: ExerciseHistoryEntry[];
  existingAchievements?: UnlockedAchievement[];
}) {
  mockLogs.count.mockResolvedValue(opts.totalLogs ?? 0);
  mockLogs.where.mockReturnValue({
    above: vi.fn().mockReturnValue({
      count: vi.fn().mockResolvedValue(opts.recentLogsCount ?? 0),
    }),
  });
  mockExerciseHistory.where.mockReturnValue({
    anyOf: vi.fn().mockReturnValue({
      toArray: vi.fn().mockResolvedValue(opts.historyRows ?? []),
    }),
  });
  mockAchievements.toArray.mockResolvedValue(opts.existingAchievements ?? []);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAchievements.put.mockResolvedValue(undefined);
});

// ---------------------------------------------------------------------------
// Individual achievement checks (synchronous, called with PrefetchedData)
// ---------------------------------------------------------------------------

describe('ACHIEVEMENTS', () => {
  it('exports 7 achievement definitions', () => {
    expect(ACHIEVEMENTS).toHaveLength(7);
  });

  describe('first-workout', () => {
    const firstWorkout = ACHIEVEMENTS.find((a) => a.id === 'first-workout')!;

    it('triggers when totalLogs is exactly 1', () => {
      const result = firstWorkout.check(makeLog(), makeData({ totalLogs: 1 }));
      expect(result.earned).toBe(true);
    });

    it('does not trigger when totalLogs is 0', () => {
      const result = firstWorkout.check(makeLog(), makeData({ totalLogs: 0 }));
      expect(result.earned).toBe(false);
    });

    it('does not trigger when totalLogs is greater than 1', () => {
      const result = firstWorkout.check(makeLog(), makeData({ totalLogs: 5 }));
      expect(result.earned).toBe(false);
    });
  });

  describe('consistency-3', () => {
    const consistency = ACHIEVEMENTS.find((a) => a.id === 'consistency-3')!;

    it('triggers when 3 or more workouts in the past week', () => {
      const result = consistency.check(makeLog(), makeData({ recentLogsCount: 3 }));
      expect(result.earned).toBe(true);
      expect(result.context).toContain('3');
    });

    it('does not trigger when fewer than 3 workouts in the past week', () => {
      const result = consistency.check(makeLog(), makeData({ recentLogsCount: 2 }));
      expect(result.earned).toBe(false);
    });

    it('triggers when more than 3 workouts in the past week', () => {
      const result = consistency.check(makeLog(), makeData({ recentLogsCount: 5 }));
      expect(result.earned).toBe(true);
      expect(result.context).toContain('5');
    });
  });

  describe('iron-will', () => {
    const ironWill = ACHIEVEMENTS.find((a) => a.id === 'iron-will')!;

    it('triggers at exactly 10 workouts', () => {
      const result = ironWill.check(makeLog(), makeData({ totalLogs: 10 }));
      expect(result.earned).toBe(true);
    });

    it('does not trigger at 9 workouts', () => {
      const result = ironWill.check(makeLog(), makeData({ totalLogs: 9 }));
      expect(result.earned).toBe(false);
    });
  });

  describe('pr-1rm (PR Breaker)', () => {
    const pr1rm = ACHIEVEMENTS.find((a) => a.id === 'pr-1rm')!;

    it('triggers on first-ever 1RM (no previous history)', () => {
      const log = makeLog({
        performedSets: [makePerformedSet('ex-bench', 100000, 5)],
      });
      const data = makeData({ exerciseHistoryByExercise: new Map() });

      const result = pr1rm.check(log, data);
      expect(result.earned).toBe(true);
      expect(result.context).toContain('Bench Press');
      expect(result.context).toContain('1RM PR');
    });

    it('triggers when beating a previous best', () => {
      const log = makeLog({
        id: 'log-2',
        performedSets: [makePerformedSet('ex-bench', 110000, 5)],
      });
      const previousHistory: ExerciseHistoryEntry[] = [
        {
          logId: 'log-1',
          exerciseId: 'ex-bench',
          exerciseName: 'Bench Press',
          performedAt: '2025-05-01T10:00:00Z',
          bestWeightG: 100000,
          totalVolumeG: 500000,
          totalSets: 3,
          totalReps: 15,
          estimated1RM_G: Math.round(100000 * (1 + 5 / 30)),
        },
      ];
      const data = makeData({
        exerciseHistoryByExercise: new Map([['ex-bench', previousHistory]]),
      });

      const result = pr1rm.check(log, data);
      expect(result.earned).toBe(true);
    });

    it('does not trigger when 1RM is lower than previous', () => {
      const log = makeLog({
        id: 'log-2',
        performedSets: [makePerformedSet('ex-bench', 90000, 5)],
      });
      const previousHistory: ExerciseHistoryEntry[] = [
        {
          logId: 'log-1',
          exerciseId: 'ex-bench',
          exerciseName: 'Bench Press',
          performedAt: '2025-05-01T10:00:00Z',
          bestWeightG: 110000,
          totalVolumeG: 550000,
          totalSets: 3,
          totalReps: 15,
          estimated1RM_G: Math.round(110000 * (1 + 5 / 30)),
        },
      ];
      const data = makeData({
        exerciseHistoryByExercise: new Map([['ex-bench', previousHistory]]),
      });

      const result = pr1rm.check(log, data);
      expect(result.earned).toBe(false);
    });

    it('does not trigger when 1RM exactly equals previous best', () => {
      const log = makeLog({
        id: 'log-2',
        performedSets: [makePerformedSet('ex-bench', 100000, 5)],
      });
      const expected1RM = 100000 * (1 + 5 / 30);
      const previousHistory: ExerciseHistoryEntry[] = [
        {
          logId: 'log-1',
          exerciseId: 'ex-bench',
          exerciseName: 'Bench Press',
          performedAt: '2025-05-01T10:00:00Z',
          bestWeightG: 100000,
          totalVolumeG: 500000,
          totalSets: 3,
          totalReps: 15,
          estimated1RM_G: expected1RM,
        },
      ];
      const data = makeData({
        exerciseHistoryByExercise: new Map([['ex-bench', previousHistory]]),
      });

      const result = pr1rm.check(log, data);
      expect(result.earned).toBe(false);
    });

    it('skips sets with >12 reps', () => {
      const log = makeLog({
        performedSets: [makePerformedSet('ex-bench', 80000, 15)],
      });
      const result = pr1rm.check(log, makeData());
      expect(result.earned).toBe(false);
    });

    it('skips sets with 0 or negative reps', () => {
      const log = makeLog({
        performedSets: [makePerformedSet('ex-bench', 80000, 0)],
      });
      const result = pr1rm.check(log, makeData());
      expect(result.earned).toBe(false);
    });

    it('skips sets with 0 or negative weight', () => {
      const log = makeLog({
        performedSets: [makePerformedSet('ex-bench', 0, 5)],
      });
      const result = pr1rm.check(log, makeData());
      expect(result.earned).toBe(false);
    });

    it('returns false for a log with no performed sets', () => {
      const log = makeLog({ performedSets: [] });
      const result = pr1rm.check(log, makeData());
      expect(result.earned).toBe(false);
    });

    it('excludes history entries from the current log', () => {
      const log = makeLog({
        id: 'log-1',
        performedSets: [makePerformedSet('ex-bench', 100000, 5)],
      });
      const expected1RM = 100000 * (1 + 5 / 30);
      const data = makeData({
        exerciseHistoryByExercise: new Map([
          [
            'ex-bench',
            [
              {
                logId: 'log-1',
                exerciseId: 'ex-bench',
                exerciseName: 'Bench Press',
                performedAt: '2025-06-01T10:00:00Z',
                bestWeightG: 100000,
                totalVolumeG: 500000,
                totalSets: 3,
                totalReps: 15,
                estimated1RM_G: expected1RM,
              },
            ],
          ],
        ]),
      });

      const result = pr1rm.check(log, data);
      expect(result.earned).toBe(true);
    });
  });

  describe('volume-king', () => {
    const volumeKing = ACHIEVEMENTS.find((a) => a.id === 'volume-king')!;

    it('triggers when session volume beats previous best', () => {
      const log = makeLog({
        id: 'log-2',
        performedSets: [
          makePerformedSet('ex-bench', 100000, 10),
          makePerformedSet('ex-bench', 100000, 10),
          makePerformedSet('ex-bench', 100000, 10),
        ],
      });
      const data = makeData({
        exerciseHistoryByExercise: new Map([
          [
            'ex-bench',
            [
              {
                logId: 'log-1',
                exerciseId: 'ex-bench',
                exerciseName: 'Bench Press',
                performedAt: '2025-05-01T10:00:00Z',
                bestWeightG: 100000,
                totalVolumeG: 2_500_000,
                totalSets: 3,
                totalReps: 25,
                estimated1RM_G: null,
              },
            ],
          ],
        ]),
      });

      const result = volumeKing.check(log, data);
      expect(result.earned).toBe(true);
      expect(result.context).toContain('Bench Press');
    });

    it('does not trigger when volume is lower than previous best', () => {
      const log = makeLog({
        id: 'log-2',
        performedSets: [makePerformedSet('ex-bench', 100000, 5)],
      });
      const data = makeData({
        exerciseHistoryByExercise: new Map([
          [
            'ex-bench',
            [
              {
                logId: 'log-1',
                exerciseId: 'ex-bench',
                exerciseName: 'Bench Press',
                performedAt: '2025-05-01T10:00:00Z',
                bestWeightG: 100000,
                totalVolumeG: 2_500_000,
                totalSets: 3,
                totalReps: 25,
                estimated1RM_G: null,
              },
            ],
          ],
        ]),
      });

      const result = volumeKing.check(log, data);
      expect(result.earned).toBe(false);
    });

    it('does not trigger on first-ever session (no previous best > 0)', () => {
      const log = makeLog({
        performedSets: [makePerformedSet('ex-bench', 100000, 10)],
      });
      const data = makeData({ exerciseHistoryByExercise: new Map() });

      const result = volumeKing.check(log, data);
      expect(result.earned).toBe(false);
    });

    it('returns false for a log with no performed sets', () => {
      const log = makeLog({ performedSets: [] });
      const result = volumeKing.check(log, makeData());
      expect(result.earned).toBe(false);
    });
  });

  describe('superset-master', () => {
    const supersetMaster = ACHIEVEMENTS.find((a) => a.id === 'superset-master')!;

    it('triggers when template has superset blocks', () => {
      const log = makeLog({
        templateSnapshot: [
          {
            id: 'sb-1',
            type: 'superset',
            sets: 3,
            exercises: [
              { exerciseId: 'ex-a', repsMin: 8, repsMax: 10 },
              { exerciseId: 'ex-b', repsMin: 10, repsMax: 12 },
            ],
            restBetweenExercisesSec: 30,
            restBetweenSupersetsSec: 120,
            transitionRestSec: null,
          },
        ],
      });

      const result = supersetMaster.check(log, makeData());
      expect(result.earned).toBe(true);
    });

    it('does not trigger when template has no superset blocks', () => {
      const log = makeLog({
        templateSnapshot: [
          {
            id: 'eb-1',
            type: 'exercise',
            exerciseId: 'ex-bench',
            sets: 3,
            repsMin: 8,
            repsMax: 12,
            restBetweenSetsSec: null,
            transitionRestSec: null,
          },
        ],
      });

      const result = supersetMaster.check(log, makeData());
      expect(result.earned).toBe(false);
    });
  });

  describe('century', () => {
    const century = ACHIEVEMENTS.find((a) => a.id === 'century')!;

    it('triggers at exactly 100 workouts', () => {
      const result = century.check(makeLog(), makeData({ totalLogs: 100 }));
      expect(result.earned).toBe(true);
    });

    it('does not trigger at 99 workouts', () => {
      const result = century.check(makeLog(), makeData({ totalLogs: 99 }));
      expect(result.earned).toBe(false);
    });

    it('triggers above 100 workouts', () => {
      const result = century.check(makeLog(), makeData({ totalLogs: 150 }));
      expect(result.earned).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// checkAchievements (async, uses prefetchAchievementData internally)
// ---------------------------------------------------------------------------

describe('checkAchievements', () => {
  it('writes new achievements and returns them', async () => {
    mockPrefetchData({ totalLogs: 1, recentLogsCount: 1 });

    const log = makeLog({ performedSets: [] });
    const unlocked = await checkAchievements(log);

    expect(unlocked.length).toBeGreaterThanOrEqual(1);
    const firstWorkout = unlocked.find((u) => u.achievementId === 'first-workout');
    expect(firstWorkout).toBeDefined();
    expect(firstWorkout!.unlockedAt).toBeDefined();
    expect(mockAchievements.put).toHaveBeenCalled();
  });

  it('skips achievements that are already unlocked', async () => {
    const existingUnlocked: UnlockedAchievement[] = [
      { achievementId: 'first-workout', unlockedAt: '2025-05-01T00:00:00Z', context: null },
    ];
    mockPrefetchData({
      totalLogs: 1,
      recentLogsCount: 1,
      existingAchievements: existingUnlocked,
    });

    const log = makeLog({ performedSets: [] });
    const unlocked = await checkAchievements(log);

    // first-workout should not be in the newly unlocked list
    const firstWorkout = unlocked.find((u) => u.achievementId === 'first-workout');
    expect(firstWorkout).toBeUndefined();
  });

  it('returns empty array when no achievements are earned', async () => {
    mockPrefetchData({
      totalLogs: 5,
      recentLogsCount: 1,
    });

    const log = makeLog({
      performedSets: [],
      templateSnapshot: [], // no supersets
    });

    const unlocked = await checkAchievements(log);
    expect(unlocked).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getUnlockedAchievements
// ---------------------------------------------------------------------------

describe('getUnlockedAchievements', () => {
  it('returns achievements sorted by unlockedAt descending', async () => {
    const mockData: UnlockedAchievement[] = [
      { achievementId: 'first-workout', unlockedAt: '2025-06-01T00:00:00Z', context: null },
      { achievementId: 'iron-will', unlockedAt: '2025-06-10T00:00:00Z', context: '10 total workouts' },
    ];

    mockAchievements.orderBy.mockReturnValue({
      reverse: vi.fn().mockReturnValue({
        toArray: vi.fn().mockResolvedValue([...mockData].reverse()),
      }),
    });

    const result = await getUnlockedAchievements();
    expect(result).toHaveLength(2);
    expect(mockAchievements.orderBy).toHaveBeenCalledWith('unlockedAt');
  });
});
