// ---------------------------------------------------------------------------
// personalRecords.ts -- Detect personal records (1RM / volume) from a workout log.
// Pure logic, no React.
// ---------------------------------------------------------------------------

import { db } from '@/lib/db';
import { calculateEpley1RM } from '@/lib/calculations';
import type { WorkoutLog } from '@/types/workout';

/**
 * Summary of personal records detected in a completed workout log.
 * Each array lists exercises where the user beat their previous best.
 */
export type PersonalRecordSummary = {
  oneRm: Array<{ exerciseId: string; name: string }>;
  volume: Array<{ exerciseId: string; name: string }>;
};

/**
 * Compare a workout log's per-exercise 1RM and total volume against all
 * prior history entries and return any new personal records.
 *
 * A PR is only awarded when there *is* a previous best to beat (i.e. this
 * isn't the first time the exercise has been logged).
 */
export async function detectPersonalRecords(
  log: WorkoutLog,
): Promise<PersonalRecordSummary> {
  const byExercise = new Map<
    string,
    { name: string; volumeG: number; best1rmG: number | null }
  >();

  for (const set of log.performedSets) {
    const prev = byExercise.get(set.exerciseId) ?? {
      name: set.exerciseNameSnapshot,
      volumeG: 0,
      best1rmG: null as number | null,
    };

    prev.volumeG += set.weightG * set.repsDone;

    const e1rm = calculateEpley1RM(set.weightG, set.repsDone);
    if (e1rm !== null) {
      prev.best1rmG =
        prev.best1rmG === null ? e1rm : Math.max(prev.best1rmG, e1rm);
    }

    byExercise.set(set.exerciseId, prev);
  }

  const exerciseIds = [...byExercise.keys()];
  if (exerciseIds.length === 0) return { oneRm: [], volume: [] };

  const history = await db.exerciseHistory
    .where('exerciseId')
    .anyOf(exerciseIds)
    .toArray();

  const prevBest1rmByExercise = new Map<string, number>();
  const prevBestVolumeByExercise = new Map<string, number>();

  for (const h of history) {
    if (h.logId === log.id) continue;

    if (h.estimated1RM_G !== null) {
      const prev = prevBest1rmByExercise.get(h.exerciseId) ?? 0;
      if (h.estimated1RM_G > prev)
        prevBest1rmByExercise.set(h.exerciseId, h.estimated1RM_G);
    }

    const prevVol = prevBestVolumeByExercise.get(h.exerciseId) ?? 0;
    if (h.totalVolumeG > prevVol)
      prevBestVolumeByExercise.set(h.exerciseId, h.totalVolumeG);
  }

  const oneRm: PersonalRecordSummary['oneRm'] = [];
  const volume: PersonalRecordSummary['volume'] = [];

  for (const [exerciseId, info] of byExercise) {
    const prevBest1rm = prevBest1rmByExercise.get(exerciseId) ?? 0;
    if (
      info.best1rmG !== null &&
      info.best1rmG > prevBest1rm &&
      prevBest1rm > 0
    ) {
      oneRm.push({ exerciseId, name: info.name });
    }

    const prevBestVol = prevBestVolumeByExercise.get(exerciseId) ?? 0;
    if (info.volumeG > prevBestVol && prevBestVol > 0) {
      volume.push({ exerciseId, name: info.name });
    }
  }

  return { oneRm, volume };
}
