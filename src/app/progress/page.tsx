'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import {
  Settings,
  TrendingUp,
  Dumbbell,
  Calendar,
  ChevronRight,
} from 'lucide-react';
import { db } from '@/lib/db';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { formatWeightValue } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProgressChart } from '@/components/history/ProgressChart';
import { AchievementCard } from '@/components/history/AchievementCard';
import type { ExerciseHistoryEntry, UnlockedAchievement } from '@/types/workout';

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
      <Icon className="mx-auto mb-1 h-4 w-4 text-text-muted" />
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

  const isLoading =
    totalWorkouts === undefined ||
    weekWorkouts === undefined ||
    totalExercises === undefined ||
    allHistory === undefined ||
    unlockedAchievements === undefined;

  return (
    <AppShell>
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
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : null}

        {!isLoading ? (
          <>
            {/* Summary Stats */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              <StatCard
                icon={Dumbbell}
                value={totalWorkouts}
                label="Total"
              />
              <StatCard
                icon={Calendar}
                value={weekWorkouts}
                label="This Week"
              />
              <StatCard
                icon={TrendingUp}
                value={totalExercises}
                label="Exercises"
              />
            </div>

            {/* Exercise Charts */}
            {exerciseGroups.length === 0 ? (
              <EmptyState
                icon={<TrendingUp className="h-12 w-12" />}
                title="No progress data yet"
                description="Complete workouts to see your exercise progress charts here"
              />
            ) : (
              <section className="mb-6">
                <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                  EXERCISE PROGRESS
                </h2>
                <div className="space-y-4">
                  {exerciseGroups.map((group) => (
                    <ExerciseProgressCard
                      key={group.exerciseId}
                      group={group}
                      unitSystem={unitSystem}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Achievements Section */}
            <section>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                ACHIEVEMENTS
              </h2>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                {ACHIEVEMENTS.map((def) => {
                  const unlocked = unlockedMap.get(def.id);
                  return (
                    <AchievementCard
                      key={def.id}
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
