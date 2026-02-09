'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import {
  Settings,
  TrendingUp,
  Dumbbell,
  Calendar,
  Clock,
  Timer,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { db } from '@/lib/db';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { formatWeight, formatWeightValue, formatDuration } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ToastContainer } from '@/components/ui';
import { ProgressChart } from '@/components/history/ProgressChart';
import { AchievementCard } from '@/components/history/AchievementCard';
import { WeightTrackerSection } from '@/components/progress/WeightTrackerSection';
import type { ExerciseHistoryEntry, UnlockedAchievement, WorkoutLog } from '@/types/workout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  entries: ExerciseHistoryEntry[];
  latestBestWeightG: number;
}

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
  avgDurationSec: number;
  totalTimeSec: number;
}

function computeDurationStats(logs: WorkoutLog[]): DurationStats {
  if (logs.length === 0) return { avgDurationSec: 0, totalTimeSec: 0 };
  const totalTimeSec = logs.reduce((sum, l) => sum + l.durationSec, 0);
  const avgDurationSec = Math.round(totalTimeSec / logs.length);
  return { avgDurationSec, totalTimeSec };
}

// ---------------------------------------------------------------------------
// Personal Records helpers (Feature 11)
// ---------------------------------------------------------------------------

interface ExercisePR {
  exerciseId: string;
  exerciseName: string;
  bestWeightG: number;
  bestWeightDate: string;
  best1RM_G: number | null;
  best1RMDate: string | null;
  bestVolumeG: number;
  bestVolumeDate: string;
}

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

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Stat Card
// ---------------------------------------------------------------------------

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
}) {
  return (
    <Card padding="sm" className="text-center">
      <div className="stat-icon mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full">
        <Icon className="h-4 w-4 text-text-muted" />
      </div>
      <p className="text-sm font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-muted">{label}</p>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Exercise Progress Card
// ---------------------------------------------------------------------------

function ExerciseProgressCard({
  group,
  unitSystem,
}: {
  group: ExerciseGroup;
  unitSystem: 'kg' | 'lb';
}) {
  return (
    <Link
      href={`/history/exercise/${group.exerciseId}`}
      className="block"
    >
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-text-primary">
              {group.exerciseName}
            </h3>
            <p className="text-xs text-text-muted">
              {group.entries.length} session{group.entries.length !== 1 ? 's' : ''} · Best:{' '}
              {formatWeightValue(group.latestBestWeightG, unitSystem)} {unitSystem}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        </div>
        <ProgressChart
          data={group.entries}
          metric="1rm"
          title="Estimated 1RM"
        />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// PR Card (Feature 11)
// ---------------------------------------------------------------------------

function PRCard({
  pr,
  unitSystem,
}: {
  pr: ExercisePR;
  unitSystem: 'kg' | 'lb';
}) {
  return (
    <Link
      href={`/history/exercise/${pr.exerciseId}`}
      className="block"
    >
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="truncate text-sm font-semibold text-text-primary">
            {pr.exerciseName}
          </h3>
          <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Best Weight */}
          <div className="rounded-xl bg-elevated p-2 text-center">
            <p className="text-xs text-text-muted">Best Weight</p>
            <p className="text-sm font-bold text-text-primary">
              {formatWeight(pr.bestWeightG, unitSystem)}
            </p>
            <p className="text-[10px] text-text-muted">
              {formatShortDate(pr.bestWeightDate)}
            </p>
          </div>

          {/* Best 1RM */}
          <div className="rounded-xl bg-elevated p-2 text-center">
            <p className="text-xs text-text-muted">Est. 1RM</p>
            <p className="text-sm font-bold text-accent">
              {pr.best1RM_G !== null
                ? formatWeight(pr.best1RM_G, unitSystem)
                : '\u2014'}
            </p>
            {pr.best1RMDate ? (
              <p className="text-[10px] text-text-muted">
                {formatShortDate(pr.best1RMDate)}
              </p>
            ) : null}
          </div>

          {/* Best Volume */}
          <div className="rounded-xl bg-elevated p-2 text-center">
            <p className="text-xs text-text-muted">Best Vol.</p>
            <p className="text-sm font-bold text-text-primary">
              {formatWeight(pr.bestVolumeG, unitSystem)}
            </p>
            <p className="text-[10px] text-text-muted">
              {formatShortDate(pr.bestVolumeDate)}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ProgressPage() {
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  // -- Queries --
  const totalWorkouts = useLiveQuery(() => db.logs.count(), []);

  const weekWorkouts = useLiveQuery(() => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    return db.logs.where('startedAt').above(since).count();
  }, []);

  const totalExercises = useLiveQuery(() => db.exercises.count(), []);

  const allLogs = useLiveQuery(
    () => db.logs.toArray(),
    [],
  );

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

  const durationStats = useMemo(
    () => computeDurationStats(allLogs ?? []),
    [allLogs],
  );

  const personalRecords = useMemo(
    () => computePersonalRecords(allHistory ?? []),
    [allHistory],
  );

  const isLoading =
    totalWorkouts === undefined ||
    weekWorkouts === undefined ||
    totalExercises === undefined ||
    allLogs === undefined ||
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
            {/* Summary Stats */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="animate-fade-in-up stagger-1">
                <StatCard
                  icon={Dumbbell}
                  value={totalWorkouts}
                  label="Total"
                />
              </div>
              <div className="animate-fade-in-up stagger-2">
                <StatCard
                  icon={Calendar}
                  value={weekWorkouts}
                  label="This Week"
                />
              </div>
              <div className="animate-fade-in-up stagger-3">
                <StatCard
                  icon={TrendingUp}
                  value={totalExercises}
                  label="Exercises"
                />
              </div>
            </div>

            {/* Duration Stats (Feature 4) */}
            {totalWorkouts > 0 ? (
              <div className="mb-6 grid grid-cols-2 gap-3">
                <StatCard
                  icon={Timer}
                  value={formatDuration(durationStats.avgDurationSec)}
                  label="Avg Duration"
                />
                <StatCard
                  icon={Clock}
                  value={formatDuration(durationStats.totalTimeSec)}
                  label="Total Time"
                />
              </div>
            ) : null}

            <WeightTrackerSection unitSystem={unitSystem} />

            {personalRecords.length > 0 ? (
              <section className="mb-6">
                <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                  <Trophy className="h-3.5 w-3.5" />
                  PERSONAL RECORDS
                </h2>
                <div className="space-y-3">
                  {personalRecords.map((pr) => (
                    <PRCard
                      key={pr.exerciseId}
                      pr={pr}
                      unitSystem={unitSystem}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {/* Exercise Charts */}
            {exerciseGroups.length === 0 ? (
              <EmptyState
                illustrationSrc="/visuals/empty/empty-progress.svg"
                illustrationAlt=""
                title="Progress starts on day one"
                description="Complete two sessions of the same exercise to unlock your first chart."
              />
            ) : (
              <section className="mb-6 animate-fade-in-up stagger-4">
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                  EXERCISE PROGRESS
                </h2>
                <div className="space-y-4">
                  {exerciseGroups.map((group, i) => (
                    <div
                      key={group.exerciseId}
                      className={`animate-fade-in-up stagger-${Math.min(i + 5, 8)}`}
                    >
                      <ExerciseProgressCard
                        group={group}
                        unitSystem={unitSystem}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Achievements Section */}
            <section className="animate-fade-in-up stagger-6">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                ACHIEVEMENTS
              </h2>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none" tabIndex={0} role="region" aria-label="Achievements">
                {ACHIEVEMENTS.map((def) => {
                  const unlocked = unlockedMap.get(def.id);
                  return (
                    <AchievementCard
                      key={def.id}
                      iconSrc={`/visuals/badges/${def.id}.svg`}
                      icon={def.icon}
                      name={def.name}
                      description={def.description}
                      isUnlocked={!!unlocked}
                      unlockedAt={unlocked?.unlockedAt}
                      context={unlocked?.context}
                    />
                  );
                })}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
