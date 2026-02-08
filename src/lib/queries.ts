import { db } from '@/lib/db';
import { calculateEpley1RM } from '@/lib/calculations';
import type { WorkoutLog, ExerciseHistoryEntry, PerformedSet } from '@/types/workout';

/** Get all logs sorted by startedAt descending. */
export async function getLogsSorted(): Promise<WorkoutLog[]> {
  return db.logs.orderBy('startedAt').reverse().toArray();
}

/** Get logs for a specific template, sorted by startedAt descending. */
export async function getLogsForTemplate(templateId: string): Promise<WorkoutLog[]> {
  return db.logs
    .where('[templateId+startedAt]')
    .between([templateId, ''], [templateId, '\uffff'])
    .reverse()
    .toArray();
}

/** Get exercise history entries for a specific exercise name, sorted by performedAt ascending. */
export async function getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryEntry[]> {
  return db.exerciseHistory
    .where('[exerciseName+performedAt]')
    .between([exerciseName, ''], [exerciseName, '\uffff'])
    .toArray();
}

/** Get exercise history entries by exerciseId. */
export async function getExerciseHistoryById(exerciseId: string): Promise<ExerciseHistoryEntry[]> {
  return db.exerciseHistory
    .where('exerciseId')
    .equals(exerciseId)
    .toArray();
}

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

/** Get total workout count. */
export async function getTotalWorkoutCount(): Promise<number> {
  return db.logs.count();
}

/** Get workouts whose startedAt is within the last N days. */
export async function getWorkoutsInLastDays(days: number): Promise<WorkoutLog[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  return db.logs.where('startedAt').above(since).toArray();
}

/** Get all exercise names from the exercise library, sorted alphabetically. */
export async function getAllExerciseNames(): Promise<string[]> {
  const exercises = await db.exercises.toArray();
  return exercises.map((e) => e.name).sort();
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
