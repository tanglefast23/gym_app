import { db } from '@/lib/db';
import type { ExerciseHistoryEntry, UnlockedAchievement, WorkoutLog } from '@/types/workout';

/**
 * Data pre-fetched in parallel before running achievement checks.
 * Avoids N sequential IndexedDB round-trips by batching all queries upfront.
 */
interface PrefetchedData {
  /** Total number of workout logs in the DB. */
  totalLogs: number;
  /** Number of workout logs started within the last 7 days. */
  recentLogsCount: number;
  /**
   * Exercise history entries for exercises that appear in the current workout log,
   * grouped by exerciseId for O(1) lookup.
   */
  exerciseHistoryByExercise: Map<string, ExerciseHistoryEntry[]>;
  /** Set of achievement IDs that have already been unlocked. */
  existingAchievementIds: Set<string>;
}

interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
  icon: string;
  check: (log: WorkoutLog, data: PrefetchedData) => { earned: boolean; context: string | null };
}

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: 'first-workout',
    name: 'First Rep',
    description: 'Complete your first workout',
    icon: '\u{1F4AA}',
    check: (_log, data) => {
      return { earned: data.totalLogs === 1, context: null };
    },
  },
  {
    id: 'consistency-3',
    name: 'Consistency',
    description: '3 workouts in a week',
    icon: '\u{1F525}',
    check: (_log, data) => {
      return {
        earned: data.recentLogsCount >= 3,
        context: `${data.recentLogsCount} workouts this week`,
      };
    },
  },
  {
    id: 'iron-will',
    name: 'Iron Will',
    description: '10 total workouts',
    icon: '\u{1F3CB}\uFE0F',
    check: (_log, data) => {
      return { earned: data.totalLogs >= 10, context: `${data.totalLogs} total workouts` };
    },
  },
  {
    id: 'pr-1rm',
    name: 'PR Breaker',
    description: 'New highest estimated 1RM on any exercise',
    icon: '\u{1F3C6}',
    check: (log, data) => {
      // Compute best estimated 1RM in THIS log per exerciseId, then compare
      // to the previous best in history.
      const bestByExercise = new Map<string, { best1RM: number; name: string }>();

      for (const set of log.performedSets) {
        if (set.repsDone > 12 || set.repsDone <= 0 || set.weightG <= 0) continue;

        const current1RM = set.weightG * (1 + set.repsDone / 30);
        const prev = bestByExercise.get(set.exerciseId);

        if (!prev || current1RM > prev.best1RM) {
          bestByExercise.set(set.exerciseId, {
            best1RM: current1RM,
            name: set.exerciseNameSnapshot,
          });
        }
      }

      if (bestByExercise.size === 0) return { earned: false, context: null };

      // Build previous-best map from prefetched history
      const previousBestByExercise = new Map<string, number>();
      for (const [exerciseId] of bestByExercise) {
        const history = data.exerciseHistoryByExercise.get(exerciseId) ?? [];
        for (const h of history) {
          if (h.logId === log.id) continue;
          if (h.estimated1RM_G === null) continue;
          const prev = previousBestByExercise.get(h.exerciseId) ?? 0;
          if (h.estimated1RM_G > prev) previousBestByExercise.set(h.exerciseId, h.estimated1RM_G);
        }
      }

      for (const [exerciseId, { best1RM, name }] of bestByExercise) {
        const previousBest = previousBestByExercise.get(exerciseId) ?? 0;

        if (best1RM > previousBest) {
          return { earned: true, context: `${name} - new 1RM PR!` };
        }
      }
      return { earned: false, context: null };
    },
  },
  {
    id: 'volume-king',
    name: 'Volume King',
    description: 'New highest session volume for an exercise',
    icon: '\u{1F451}',
    check: (log, data) => {
      const exerciseVolumes = new Map<string, { volume: number; name: string }>();

      for (const set of log.performedSets) {
        const existing = exerciseVolumes.get(set.exerciseId) ?? {
          volume: 0,
          name: set.exerciseNameSnapshot,
        };
        existing.volume += set.weightG * set.repsDone;
        exerciseVolumes.set(set.exerciseId, existing);
      }

      if (exerciseVolumes.size === 0) return { earned: false, context: null };

      // Build previous-best volume map from prefetched history
      const previousBestByExercise = new Map<string, number>();
      for (const [exerciseId] of exerciseVolumes) {
        const history = data.exerciseHistoryByExercise.get(exerciseId) ?? [];
        for (const h of history) {
          if (h.logId === log.id) continue;
          const prev = previousBestByExercise.get(h.exerciseId) ?? 0;
          if (h.totalVolumeG > prev) previousBestByExercise.set(h.exerciseId, h.totalVolumeG);
        }
      }

      for (const [exerciseId, { volume, name }] of exerciseVolumes) {
        const previousBest = previousBestByExercise.get(exerciseId) ?? 0;

        if (volume > previousBest && previousBest > 0) {
          return { earned: true, context: `${name} - volume PR!` };
        }
      }
      return { earned: false, context: null };
    },
  },
  {
    id: 'superset-master',
    name: 'Superset Master',
    description: 'Complete a workout containing supersets',
    icon: '\u{26A1}',
    check: (log) => {
      const hasSupersets = log.templateSnapshot.some((b) => b.type === 'superset');
      return { earned: hasSupersets, context: null };
    },
  },
  {
    id: 'century',
    name: 'Century',
    description: '100 total workouts',
    icon: '\u{1F4AF}',
    check: (_log, data) => {
      return { earned: data.totalLogs >= 100, context: `${data.totalLogs} total workouts!` };
    },
  },
];

/**
 * Pre-fetch all data needed by achievement checks in parallel.
 *
 * This replaces ~8 sequential IndexedDB queries with ~4 parallel ones,
 * reducing total wall-clock time from O(n * latency) to O(latency).
 */
async function prefetchAchievementData(log: WorkoutLog): Promise<PrefetchedData> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Collect unique exerciseIds from the workout log for targeted history fetch
  const exerciseIds = [...new Set(log.performedSets.map((s) => s.exerciseId))];

  const [totalLogs, recentLogsCount, historyRows, existingAchievements] = await Promise.all([
    db.logs.count(),
    db.logs.where('startedAt').above(weekAgo).count(),
    exerciseIds.length > 0
      ? db.exerciseHistory.where('exerciseId').anyOf(exerciseIds).toArray()
      : Promise.resolve([]),
    db.achievements.toArray(),
  ]);

  // Group history entries by exerciseId for O(1) lookup
  const exerciseHistoryByExercise = new Map<string, ExerciseHistoryEntry[]>();
  for (const entry of historyRows) {
    const bucket = exerciseHistoryByExercise.get(entry.exerciseId);
    if (bucket) {
      bucket.push(entry);
    } else {
      exerciseHistoryByExercise.set(entry.exerciseId, [entry]);
    }
  }

  return {
    totalLogs,
    recentLogsCount,
    exerciseHistoryByExercise,
    existingAchievementIds: new Set(existingAchievements.map((a) => a.achievementId)),
  };
}

/**
 * Check all achievement definitions against a newly saved workout log.
 *
 * Skips achievements that are already unlocked. Returns an array of
 * newly unlocked achievements (persisted to the database).
 */
export async function checkAchievements(log: WorkoutLog): Promise<UnlockedAchievement[]> {
  const data = await prefetchAchievementData(log);

  const newlyUnlocked: UnlockedAchievement[] = [];

  for (const achievement of ACHIEVEMENTS) {
    if (data.existingAchievementIds.has(achievement.id)) continue;

    const result = achievement.check(log, data);
    if (result.earned) {
      const unlock: UnlockedAchievement = {
        achievementId: achievement.id,
        unlockedAt: new Date().toISOString(),
        context: result.context,
      };
      await db.achievements.put(unlock);
      newlyUnlocked.push(unlock);
    }
  }

  return newlyUnlocked;
}

/** Get all unlocked achievements, sorted by unlockedAt descending (most recent first). */
export async function getUnlockedAchievements(): Promise<UnlockedAchievement[]> {
  return db.achievements.orderBy('unlockedAt').reverse().toArray();
}
