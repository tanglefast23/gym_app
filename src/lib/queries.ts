import { db } from '@/lib/db';
import { calculateEpley1RM } from '@/lib/calculations';
import type { WorkoutLog, ExerciseHistoryEntry, PerformedSet } from '@/types/workout';

/**
 * Write denormalized exercise history entries after a workout log is saved.
 *
 * Groups performed sets by exerciseId and computes aggregate metrics
 * (volume, best weight, estimated 1RM) for each exercise in the log.
 * Call this after saving a WorkoutLog.
 */
export async function writeExerciseHistory(log: WorkoutLog): Promise<void> {
  const exerciseMap = new Map<string, PerformedSet[]>();

  for (const set of log.performedSets) {
    const existing = exerciseMap.get(set.exerciseId) ?? [];
    existing.push(set);
    exerciseMap.set(set.exerciseId, existing);
  }

  const entries: ExerciseHistoryEntry[] = [];

  for (const [exerciseId, sets] of exerciseMap) {
    const totalVolumeG = sets.reduce((sum, s) => sum + s.weightG * s.repsDone, 0);
    const totalReps = sets.reduce((sum, s) => sum + s.repsDone, 0);

    let best1RM: number | null = null;
    let bestWeightG = 0;

    for (const set of sets) {
      if (set.weightG > bestWeightG) bestWeightG = set.weightG;
      const e1rm = calculateEpley1RM(set.weightG, set.repsDone);
      if (e1rm !== null && (best1RM === null || e1rm > best1RM)) {
        best1RM = e1rm;
      }
    }

    entries.push({
      logId: log.id,
      exerciseId,
      exerciseName: sets[0].exerciseNameSnapshot,
      performedAt: log.startedAt,
      bestWeightG,
      totalVolumeG,
      totalSets: sets.length,
      totalReps,
      estimated1RM_G: best1RM,
    });
  }

  await db.exerciseHistory.bulkAdd(entries);
}

/**
 * Get the last performed sets for a specific exercise.
 *
 * Looks up the most recent exercise history entry for the given exerciseId,
 * then retrieves the matching performed sets from that workout log.
 * Useful for weight/rep prefill when starting a new workout.
 */
export async function getLastPerformedSets(exerciseId: string): Promise<PerformedSet[]> {
  const latestEntry = await db.exerciseHistory
    .where('[exerciseId+performedAt]')
    .between([exerciseId, ''], [exerciseId, '\uffff'])
    .reverse()
    .first();

  if (!latestEntry) return [];

  const latestLogId = latestEntry.logId;
  const log = await db.logs.get(latestLogId);
  if (!log) return [];

  return log.performedSets.filter((s) => s.exerciseId === exerciseId);
}

/**
 * Batch-fetch the last performed sets for multiple exercises in a single query.
 *
 * Instead of calling `getLastPerformedSets` N times (one IndexedDB round-trip
 * per exerciseId), this function:
 * 1. Fetches all exercise history entries matching the given IDs in one query.
 * 2. Groups entries by exerciseId, keeping only the most recent per exercise.
 * 3. Loads each unique logId once, then extracts the matching performed sets.
 *
 * Returns a `Map<string, PerformedSet[]>` keyed by exerciseId.
 */
export async function getLastPerformedSetsForMultiple(
  exerciseIds: string[],
): Promise<Map<string, PerformedSet[]>> {
  const result = new Map<string, PerformedSet[]>();
  if (exerciseIds.length === 0) return result;

  // Deduplicate inputs to avoid redundant IndexedDB queries.
  const uniqueExerciseIds = [...new Set(exerciseIds)].filter((id) => id.length > 0);
  if (uniqueExerciseIds.length === 0) return result;

  // Fetch ONLY the latest ExerciseHistoryEntry per exerciseId.
  // This intentionally does N small queries instead of 1 large query that could
  // materialize thousands of rows (and spike memory) for long-time users.
  const latestEntries = await Promise.all(
    uniqueExerciseIds.map(async (exerciseId) => {
      const entry = await db.exerciseHistory
        .where('[exerciseId+performedAt]')
        .between([exerciseId, ''], [exerciseId, '\uffff'])
        .reverse()
        .first();
      return entry ? { exerciseId, logId: entry.logId } : null;
    }),
  );

  // Collect unique logIds to fetch (multiple exercises may share a log).
  const uniqueLogIds = new Set<string>();
  const latestLogIdByExercise = new Map<string, string>();
  for (const item of latestEntries) {
    if (!item) continue;
    latestLogIdByExercise.set(item.exerciseId, item.logId);
    uniqueLogIds.add(item.logId);
  }

  if (uniqueLogIds.size === 0) return result;

  // Fetch all required logs in a single batch.
  const logs = await db.logs.bulkGet([...uniqueLogIds]);
  const logMap = new Map<string, WorkoutLog>();
  for (const log of logs) {
    if (log) logMap.set(log.id, log);
  }

  // Extract performed sets for each exerciseId from the corresponding log.
  for (const [exerciseId, logId] of latestLogIdByExercise) {
    const log = logMap.get(logId);
    if (!log) continue;
    const sets = log.performedSets.filter((s) => s.exerciseId === exerciseId);
    if (sets.length > 0) result.set(exerciseId, sets);
  }

  return result;
}

/**
 * Delete a single workout log and its related exercise history entries.
 */
export async function deleteLog(logId: string): Promise<void> {
  const historyEntries = await db.exerciseHistory
    .where('logId')
    .equals(logId)
    .toArray();

  const historyIds = historyEntries
    .filter((h) => h.id !== undefined)
    .map((h) => h.id as number);

  await Promise.all([
    db.logs.delete(logId),
    historyIds.length > 0 ? db.exerciseHistory.bulkDelete(historyIds) : Promise.resolve(),
  ]);
}

/** Get data counts for all tables (useful for "Delete All Data" confirmation). */
export async function getDataCounts(): Promise<{
  exercises: number;
  templates: number;
  logs: number;
  exerciseHistory: number;
  achievements: number;
  bodyWeights: number;
}> {
  const [exercises, templates, logs, exerciseHistory, achievements, bodyWeights] = await Promise.all([
    db.exercises.count(),
    db.templates.count(),
    db.logs.count(),
    db.exerciseHistory.count(),
    db.achievements.count(),
    db.bodyWeights.count(),
  ]);
  return { exercises, templates, logs, exerciseHistory, achievements, bodyWeights };
}

/**
 * Delete ALL user data except settings.
 *
 * Clears exercises, templates, logs, exerciseHistory, achievements,
 * bodyWeights, and crashRecovery tables inside a single Dexie transaction
 * so a crash mid-deletion cannot leave orphaned records.
 * Settings are preserved.
 */
export async function deleteAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.templates, db.logs, db.exerciseHistory, db.achievements, db.bodyWeights, db.crashRecovery],
    async () => {
      await Promise.all([
        db.exercises.clear(),
        db.templates.clear(),
        db.logs.clear(),
        db.exerciseHistory.clear(),
        db.achievements.clear(),
        db.bodyWeights.clear(),
        db.crashRecovery.clear(),
      ]);
    },
  );
}

/**
 * Preview how many items would be deleted within a date range.
 *
 * Returns counts without actually deleting anything.
 * Uses the `startedAt` field for logs and `performedAt` for exerciseHistory.
 */
export async function previewDeleteByDateRange(
  fromISO: string,
  toISO: string,
): Promise<{ logs: number; exerciseHistory: number }> {
  const logsInRange = await db.logs
    .where('startedAt')
    .between(fromISO, toISO, true, true)
    .count();

  const historyInRange = await db.exerciseHistory
    .where('performedAt')
    .between(fromISO, toISO, true, true)
    .count();

  return { logs: logsInRange, exerciseHistory: historyInRange };
}

/**
 * Delete logs and exercise history within a date range.
 *
 * Wrapped in a Dexie transaction so a crash mid-deletion cannot leave
 * orphaned records across the two tables.
 * Returns the count of deleted items.
 */
export async function deleteDataByDateRange(
  fromISO: string,
  toISO: string,
): Promise<{ deletedLogs: number; deletedHistory: number }> {
  const logsToDelete = await db.logs
    .where('startedAt')
    .between(fromISO, toISO, true, true)
    .toArray();

  const logIds = new Set(logsToDelete.map((l) => l.id));

  const historyToDelete = await db.exerciseHistory
    .where('performedAt')
    .between(fromISO, toISO, true, true)
    .toArray();

  const historyIds = historyToDelete
    .filter((h) => h.id !== undefined)
    .map((h) => h.id as number);

  await db.transaction(
    'rw',
    [db.logs, db.exerciseHistory],
    async () => {
      await Promise.all([
        db.logs.bulkDelete([...logIds]),
        db.exerciseHistory.bulkDelete(historyIds),
      ]);
    },
  );

  return { deletedLogs: logIds.size, deletedHistory: historyIds.length };
}
