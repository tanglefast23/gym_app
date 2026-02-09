'use client';

import { useMemo, useCallback, useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings,
  TrendingUp,
  Dumbbell,
  Calendar,
  Clock,
  Timer,
  Trophy,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react';
import { db } from '@/lib/db';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { displayToGrams, formatWeight, formatWeightValue, formatDuration } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { ProgressChart } from '@/components/history/ProgressChart';
import { AchievementCard } from '@/components/history/AchievementCard';
import { ScaleIcon } from '@/components/icons/ScaleIcon';
import { BodyWeightChart } from '@/components/weight/BodyWeightChart';
import { TimelinePills, type WeightTimeline } from '@/components/weight/TimelinePills';
import { latestPerDay } from '@/lib/bodyWeight';
import type { ExerciseHistoryEntry, UnlockedAchievement, WorkoutLog } from '@/types/workout';
import type { BodyWeightEntry, UnitSystem } from '@/types/workout';

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
  const router = useRouter();
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

  const bodyWeights = useLiveQuery(
    () => db.bodyWeights.orderBy('recordedAt').toArray(),
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
    unlockedAchievements === undefined ||
    bodyWeights === undefined;

  // ---------------------------------------------------------------------------
  // Weight Tracker UI state + helpers
  // ---------------------------------------------------------------------------

  const [weightTimeline, setWeightTimeline] = useState<WeightTimeline>('week');
  const [todayDraft, setTodayDraft] = useState<number>(0);
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(false);

  const step = unitSystem === 'kg' ? 0.1 : 0.5;

  const latestEntry = useMemo(() => {
    const arr = bodyWeights ?? [];
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }, [bodyWeights]);

  const todayKey = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const latestByDay = useMemo(() => latestPerDay(bodyWeights ?? []), [bodyWeights]);

  const todaysEntry = useMemo(() => {
    const byKey = new Map(latestByDay.map((x) => [x.dateKey, x.entry]));
    return byKey.get(todayKey) ?? null;
  }, [latestByDay, todayKey]);

  // Keep the draft in sync with today's existing entry (and fall back to latest entry).
  useEffect(() => {
    const base = (todaysEntry ?? latestEntry)?.weightG;
    if (base == null) return;
    if (draftInitialized && !todaysEntry) return;
    const v = Number(formatWeightValue(base, unitSystem));
    if (Number.isFinite(v)) {
      setTodayDraft(v);
      setDraftInitialized(true);
    }
  }, [todaysEntry, latestEntry, unitSystem, draftInitialized]);

  const handleAdjustDraft = useCallback(
    (delta: number) => {
      setTodayDraft((v) => {
        const next = Math.max(0, Math.round((v + delta) * 10) / 10);
        return next;
      });
    },
    [],
  );

  const handleSubmitToday = useCallback(async () => {
    const value = todayDraft;
    if (!Number.isFinite(value) || value <= 0) return;
    setIsSubmittingWeight(true);
    try {
      const now = new Date().toISOString();
      const entry: BodyWeightEntry = {
        id: todayKey, // one entry per day; update replaces the same key
        recordedAt: now,
        weightG: displayToGrams(value, unitSystem),
      };
      await db.bodyWeights.put(entry);
    } finally {
      setIsSubmittingWeight(false);
    }
  }, [todayDraft, todayKey, unitSystem]);

  function buildChartData(
    entries: BodyWeightEntry[],
    timeline: WeightTimeline,
    unit: UnitSystem,
  ): Array<{ label: string; value: number | null }> {
    const byDay = latestPerDay(entries);
    const today = new Date();

    if (timeline === 'day') {
      // Last 2 days (today + yesterday) in local time, by-day points.
      const labels: string[] = [];
      const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));

      for (let i = 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        labels.push(k);
      }

      return labels.map((k) => {
        const e = values.get(k);
        return {
          label: k.slice(5), // MM-DD
          value: e ? Number(formatWeightValue(e.weightG, unit)) : null,
        };
      });
    }

    if (timeline === 'year') {
      // Last 12 months, monthly latest.
      const monthMap = new Map<string, BodyWeightEntry>();
      for (const { dateKey, entry } of byDay) {
        const monthKey = dateKey.slice(0, 7); // YYYY-MM
        const existing = monthMap.get(monthKey);
        if (!existing || entry.recordedAt > existing.recordedAt) {
          monthMap.set(monthKey, entry);
        }
      }

      const points: Array<{ label: string; value: number | null }> = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(today);
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const e = monthMap.get(key);
        points.push({
          label: `${String(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
          value: e ? Number(formatWeightValue(e.weightG, unit)) : null,
        });
      }
      return points;
    }

    // week: last 7 days
    const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));
    const points: Array<{ label: string; value: number | null }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const e = values.get(k);
      points.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        value: e ? Number(formatWeightValue(e.weightG, unit)) : null,
      });
    }
    return points;
  }

  const weightChartData = useMemo(
    () => buildChartData(bodyWeights ?? [], weightTimeline, unitSystem),
    [bodyWeights, weightTimeline, unitSystem],
  );

  const recentEntries = useMemo(() => {
    const byDay = latestPerDay(bodyWeights ?? []);
    const last = byDay.slice(-5).reverse(); // latest first
    return last.map((x, idx) => {
      const prev = last[idx + 1]?.entry ?? null;
      const deltaG = prev ? x.entry.weightG - prev.weightG : null;
      return { ...x, deltaG };
    });
  }, [bodyWeights]);

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

            {/* Personal Records (Feature 11) */}
            <section className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                <ScaleIcon className="h-3.5 w-3.5" />
                WEIGHT TRACKER
              </h2>

              {/* Today's weight input */}
              <Card
                padding="md"
                className="mb-3"
                onClick={() => router.push('/weight')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Today&apos;s weight
                    </p>
                    <p className="text-xs text-text-muted">
                      Tap to view full history
                    </p>
                  </div>
                  <p className="text-xs text-text-muted">
                    {unitSystem === 'kg' ? 'kg' : 'lbs'}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdjustDraft(-step);
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-elevated text-text-primary transition-transform active:scale-[0.97]"
                    aria-label="Decrease body weight"
                  >
                    <Minus className="h-5 w-5" />
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const next = window.prompt(
                        `Enter today\\'s weight (${unitSystem === 'kg' ? 'kg' : 'lbs'})`,
                        String(todayDraft || ''),
                      );
                      if (next === null) return;
                      const parsed = Number(next);
                      if (!Number.isFinite(parsed)) return;
                      setTodayDraft(Math.max(0, Math.round(parsed * 10) / 10));
                    }}
                    className="min-w-[7.5rem] rounded-2xl border border-border bg-surface px-4 py-3 text-center font-timer text-4xl text-text-primary"
                    aria-label="Edit today's body weight"
                  >
                    {todayDraft ? todayDraft.toFixed(todayDraft % 1 === 0 ? 0 : 1) : '—'}
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAdjustDraft(step);
                    }}
                    className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-elevated text-text-primary transition-transform active:scale-[0.97]"
                    aria-label="Increase body weight"
                  >
                    <Plus className="h-5 w-5" />
                  </button>

                  <Button
                    size="sm"
                    variant="primary"
                    disabled={todayDraft <= 0}
                    loading={isSubmittingWeight}
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSubmitToday();
                    }}
                  >
                    Submit
                  </Button>
                </div>
              </Card>

              {/* Recent changes + chart */}
              <Card
                padding="md"
                onClick={() => router.push('/weight')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-text-primary">
                      Recent changes
                    </p>
                    <p className="text-xs text-text-muted">
                      Last {weightTimeline} view
                    </p>
                  </div>
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <TimelinePills
                      value={weightTimeline}
                      onChange={(v) => setWeightTimeline(v)}
                    />
                  </div>
                </div>

                <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-3">
                  <BodyWeightChart data={weightChartData} unitSystem={unitSystem} height={140} />
                </div>

                {recentEntries.length > 0 ? (
                  <div className="mt-4 space-y-2">
                    {recentEntries.map(({ dateKey, entry, deltaG }) => (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between rounded-xl bg-elevated px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-text-secondary">
                            {dateKey}
                          </p>
                          <p className="text-[11px] text-text-muted">
                            {new Date(entry.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-text-primary">
                            {formatWeight(entry.weightG, unitSystem)}
                          </p>
                          {deltaG !== null ? (
                            <p className={`text-[11px] ${deltaG >= 0 ? 'text-success' : 'text-danger'}`}>
                              {deltaG >= 0 ? '+' : ''}
                              {formatWeightValue(deltaG, unitSystem)} {unitSystem}
                            </p>
                          ) : (
                            <p className="text-[11px] text-text-muted">—</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-text-muted">
                    No weight entries yet. Add today&apos;s weight to start tracking.
                  </p>
                )}
              </Card>
            </section>

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
