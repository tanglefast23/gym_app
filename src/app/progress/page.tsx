'use client';

import { useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { Settings } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { db } from '@/lib/db';
import { useSettingsStore } from '@/stores/settingsStore';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { ToastContainer } from '@/components/ui';
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

/** Group all exercise history entries by exerciseId. Sorted by most recent first. */
function groupExerciseHistory(all: ExerciseHistoryEntry[]): ExerciseGroup[] {
  const map = new Map<string, ExerciseGroup>();

  for (const entry of all) {
    const existing = map.get(entry.exerciseId);
    if (existing) {
      existing.entries.push(entry);
      if (entry.bestWeightG > existing.latestBestWeightG) {
        existing.latestBestWeightG = entry.bestWeightG;
      }
    } else {
      map.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        entries: [entry],
        latestBestWeightG: entry.bestWeightG,
      });
    }
  }

  // Sort by most recently performed exercise first
  return Array.from(map.values()).sort((a, b) => {
    const aLatest = a.entries[a.entries.length - 1]?.performedAt ?? '';
    const bLatest = b.entries[b.entries.length - 1]?.performedAt ?? '';
    return bLatest.localeCompare(aLatest);
  });
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
// Personal Records helpers (Feature 11)
// ---------------------------------------------------------------------------

function computePersonalRecords(all: ExerciseHistoryEntry[]): ExercisePR[] {
  const map = new Map<string, ExercisePR>();

  for (const entry of all) {
    const existing = map.get(entry.exerciseId);

    if (!existing) {
      map.set(entry.exerciseId, {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        bestWeightG: entry.bestWeightG,
        bestWeightDate: entry.performedAt,
        best1RM_G: entry.estimated1RM_G,
        best1RMDate: entry.estimated1RM_G ? entry.performedAt : null,
        bestVolumeG: entry.totalVolumeG,
        bestVolumeDate: entry.performedAt,
      });
      continue;
    }

    if (entry.bestWeightG > existing.bestWeightG) {
      existing.bestWeightG = entry.bestWeightG;
      existing.bestWeightDate = entry.performedAt;
    }

    if (
      entry.estimated1RM_G !== null &&
      (existing.best1RM_G === null || entry.estimated1RM_G > existing.best1RM_G)
    ) {
      existing.best1RM_G = entry.estimated1RM_G;
      existing.best1RMDate = entry.performedAt;
    }

    if (entry.totalVolumeG > existing.bestVolumeG) {
      existing.bestVolumeG = entry.totalVolumeG;
      existing.bestVolumeDate = entry.performedAt;
    }
  }

  // Sort by most recent PR date (any category)
  return Array.from(map.values()).sort((a, b) => {
    const aDate = [a.bestWeightDate, a.best1RMDate, a.bestVolumeDate]
      .filter(Boolean)
      .sort()
      .pop() ?? '';
    const bDate = [b.bestWeightDate, b.best1RMDate, b.bestVolumeDate]
      .filter(Boolean)
      .sort()
      .pop() ?? '';
    return bDate.localeCompare(aDate);
  });
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const searchParams = useSearchParams();

  // Allow deep-links into the "Today's weight" editor (used by BMI prompts).
  useEffect(() => {
    const focus = searchParams.get('focus');
    if (focus !== 'today-weight') return;

    // Scroll and then open the inline editor.
    requestAnimationFrame(() => {
      document.getElementById('today-weight')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      window.dispatchEvent(new Event('workout-pwa:focus-today-weight'));
    });
  }, [searchParams]);

  // -- Queries --
  const durationStats = useLiveQuery(() => computeDurationStats(), []);

  const weekWorkouts = useLiveQuery(() => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return db.logs.where('startedAt').above(since).count();
  }, []);

  const totalExercises = useLiveQuery(() => db.exercises.count(), []);

  const allHistory = useLiveQuery(
    () => db.exerciseHistory.orderBy('performedAt').toArray(),
    [],
  );

  const unlockedAchievements = useLiveQuery(
    () => db.achievements.toArray(),
    [],
  );

  // -- Derived data --
  const exerciseGroups = useMemo(
    () => groupExerciseHistory(allHistory ?? []),
    [allHistory],
  );

  const unlockedMap = useMemo(
    () => buildUnlockedMap(unlockedAchievements ?? []),
    [unlockedAchievements],
  );

  const personalRecords = useMemo(
    () => computePersonalRecords(allHistory ?? []),
    [allHistory],
  );

  const isLoading =
    durationStats === undefined ||
    weekWorkouts === undefined ||
    totalExercises === undefined ||
    allHistory === undefined ||
    unlockedAchievements === undefined;

  return (
    <AppShell>
      <ToastContainer />
      <Header
        title="Progress"
        rightAction={
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated"
          >
            <Settings className="h-5 w-5 text-text-secondary" />
          </Link>
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
