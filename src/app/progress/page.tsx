'use client';

import { Suspense, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { ToastContainer, FontSizeToggle } from '@/components/ui';
import { WeightTrackerSection } from '@/components/progress/WeightTrackerSection';
import { StatsSection } from '@/components/progress/StatsSection';
import { PersonalRecordsSection } from '@/components/progress/PersonalRecordsSection';
import { ExerciseProgressSection } from '@/components/progress/ExerciseProgressSection';
import { AchievementsSection } from '@/components/progress/AchievementsSection';
import type { ExerciseHistoryEntry, UnlockedAchievement, WorkoutLog } from '@/types/workout';
import type { ExerciseGroup } from '@/components/progress/ExerciseProgressSection';
import type { ExercisePR } from '@/components/progress/PersonalRecordsSection';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Keep charts responsive by limiting how many history points we keep per exercise.
 * This also avoids holding the entire exerciseHistory table in memory.
 */
const HISTORY_POINTS_PER_EXERCISE = 60;

type ExerciseGroupWithLast = { group: ExerciseGroup; lastPerformedAt: string };

async function computeExerciseHistorySummary(): Promise<{
  exerciseGroups: ExerciseGroup[];
  personalRecords: ExercisePR[];
}> {
  const groups = new Map<string, ExerciseGroupWithLast>();
  const prs = new Map<string, ExercisePR>();

  // Iterate in chronological order so each exercise's `lastPerformedAt`
  // is simply the last entry we see.
  await db.exerciseHistory.orderBy('performedAt').each((entry: ExerciseHistoryEntry) => {
    const existing = groups.get(entry.exerciseId);
    if (existing) {
      existing.group.totalSessions += 1;
      existing.lastPerformedAt = entry.performedAt;
      if (entry.bestWeightG > existing.group.latestBestWeightG) {
        existing.group.latestBestWeightG = entry.bestWeightG;
      }

      existing.group.entries.push(entry);
      if (existing.group.entries.length > HISTORY_POINTS_PER_EXERCISE) {
        existing.group.entries.shift();
      }
    } else {
      groups.set(entry.exerciseId, {
        group: {
          exerciseId: entry.exerciseId,
          exerciseName: entry.exerciseName,
          entries: [entry],
          latestBestWeightG: entry.bestWeightG,
          totalSessions: 1,
        },
        lastPerformedAt: entry.performedAt,
      });
    }

    const pr = prs.get(entry.exerciseId);
    if (!pr) {
      prs.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        bestWeightG: entry.bestWeightG,
        bestWeightDate: entry.performedAt,
        best1RM_G: entry.estimated1RM_G,
        best1RMDate: entry.estimated1RM_G ? entry.performedAt : null,
        bestVolumeG: entry.totalVolumeG,
        bestVolumeDate: entry.performedAt,
      });
    } else {
      if (entry.bestWeightG > pr.bestWeightG) {
        pr.bestWeightG = entry.bestWeightG;
        pr.bestWeightDate = entry.performedAt;
      }

      if (
        entry.estimated1RM_G !== null &&
        (pr.best1RM_G === null || entry.estimated1RM_G > pr.best1RM_G)
      ) {
        pr.best1RM_G = entry.estimated1RM_G;
        pr.best1RMDate = entry.performedAt;
      }

      if (entry.totalVolumeG > pr.bestVolumeG) {
        pr.bestVolumeG = entry.totalVolumeG;
        pr.bestVolumeDate = entry.performedAt;
      }
    }
  });

  const exerciseGroups = Array.from(groups.values())
    .sort((a, b) => b.lastPerformedAt.localeCompare(a.lastPerformedAt))
    .map((x) => x.group);

  const personalRecords = Array.from(prs.values()).sort((a, b) => {
    const aDate = [a.bestWeightDate, a.best1RMDate, a.bestVolumeDate]
      .filter(Boolean)
      .sort()
      .pop() ?? '';
    const bDate = [b.bestWeightDate, b.best1RMDate, b.bestVolumeDate]
      .filter(Boolean)
      .sort()
      .pop() ?? '';
    return bDate.localeCompare(aDate) || a.exerciseName.localeCompare(b.exerciseName);
  });

  return { exerciseGroups, personalRecords };
}

/** Build a lookup map from achievement ID to its unlocked data. */
function buildUnlockedMap(
  unlocked: UnlockedAchievement[],
): Map<string, UnlockedAchievement> {
  const map = new Map<string, UnlockedAchievement>();
  for (const a of unlocked) {
    map.set(a.achievementId, a);
  }
  return map;
}

// ---------------------------------------------------------------------------
// Duration helpers (Feature 4)
// ---------------------------------------------------------------------------

interface DurationStats {
  totalWorkouts: number;
  avgDurationSec: number;
  totalTimeSec: number;
}

async function computeDurationStats(): Promise<DurationStats> {
  let totalWorkouts = 0;
  let totalTimeSec = 0;
  await db.logs.each((l: WorkoutLog) => {
    totalWorkouts += 1;
    totalTimeSec += l.durationSec;
  });
  const avgDurationSec =
    totalWorkouts > 0 ? Math.round(totalTimeSec / totalWorkouts) : 0;
  return { totalWorkouts, avgDurationSec, totalTimeSec };
}

// ---------------------------------------------------------------------------
// Personal Records (Feature 11)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

/** Handles ?focus=today-weight deep-link. Wrapped in Suspense by the page. */
function FocusTodayWeight() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus !== 'today-weight') return;

    requestAnimationFrame(() => {
      document.getElementById('today-weight')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      window.dispatchEvent(new Event('workout-pwa:focus-today-weight'));
    });
  }, [searchParams]);

  return null;
}

export default function ProgressPage() {
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  // -- Queries --
  const durationStats = useLiveQuery(() => computeDurationStats(), []);

  const weekWorkouts = useLiveQuery(() => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return db.logs.where('startedAt').above(since).count();
  }, []);

  const totalExercises = useLiveQuery(() => db.exercises.count(), []);

  const historySummary = useLiveQuery(() => computeExerciseHistorySummary(), []);

  const unlockedAchievements = useLiveQuery(
    () => db.achievements.toArray(),
    [],
  );

  // -- Derived data --
  const exerciseGroups = historySummary?.exerciseGroups ?? [];

  const unlockedMap = useMemo(
    () => buildUnlockedMap(unlockedAchievements ?? []),
    [unlockedAchievements],
  );

  const personalRecords = historySummary?.personalRecords ?? [];

  const isLoading =
    durationStats === undefined ||
    weekWorkouts === undefined ||
    totalExercises === undefined ||
    historySummary === undefined ||
    unlockedAchievements === undefined;

  return (
    <AppShell>
      <Suspense fallback={null}>
        <FocusTodayWeight />
      </Suspense>
      <ToastContainer />
      <Header
        title="Progress"
        rightAction={
          <div className="flex items-center gap-2">
            <FontSizeToggle />
            <Link
              href="/settings"
              aria-label="Settings"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated"
            >
              <Settings className="h-5 w-5 text-text-secondary" />
            </Link>
          </div>
        }
      />

      <div className="px-5 pt-4 pb-8">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : null}

        {!isLoading ? (
          <>
            <StatsSection
              totalWorkouts={durationStats.totalWorkouts}
              weekWorkouts={weekWorkouts}
              totalExercises={totalExercises}
              avgDurationSec={durationStats.avgDurationSec}
              totalTimeSec={durationStats.totalTimeSec}
            />

            <WeightTrackerSection unitSystem={unitSystem} />

            <PersonalRecordsSection
              personalRecords={personalRecords}
              unitSystem={unitSystem}
            />

            <ExerciseProgressSection
              exerciseGroups={exerciseGroups}
              unitSystem={unitSystem}
            />

            <AchievementsSection unlockedMap={unlockedMap} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
