'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Calendar, Layers, TrendingUp } from 'lucide-react';
import { db } from '@/lib/db';
import { formatWeight, formatWeightValue } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { ProgressChart } from '@/components/history/ProgressChart';
import type { ExerciseHistoryEntry } from '@/types/workout';

/**
 * Formats a date for the recent sessions list.
 */
function formatSessionDate(isoString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(isoString));
}

/**
 * A row in the recent sessions list.
 */
function SessionRow({
  entry,
  unitSystem,
}: {
  entry: ExerciseHistoryEntry;
  unitSystem: 'kg' | 'lb';
}) {
  return (
    <div className="flex items-center justify-between border-t border-border py-3">
      <div className="flex items-center gap-3">
        <Calendar className="h-4 w-4 text-text-muted" />
        <div>
          <p className="text-sm font-medium text-text-primary">
            {formatSessionDate(entry.performedAt)}
          </p>
          <p className="text-xs text-text-muted">
            {entry.totalSets} sets / {entry.totalReps} reps
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-text-primary">
          {formatWeightValue(entry.bestWeightG, unitSystem)} {unitSystem}
        </p>
        <p className="text-xs text-text-muted">
          {formatWeight(entry.totalVolumeG, unitSystem)} vol
        </p>
      </div>
    </div>
  );
}

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  const exercise = useLiveQuery(
    () => db.exercises.get(params.id),
    [params.id],
  );

  const exerciseHistory = useLiveQuery(
    () =>
      db.exerciseHistory
        .where('exerciseId')
        .equals(params.id)
        .sortBy('performedAt'),
    [params.id],
  );

  const recentSessions = useMemo(() => {
    if (!exerciseHistory) return [];
    // Show most recent first, up to 20 entries
    return [...exerciseHistory].reverse().slice(0, 20);
  }, [exerciseHistory]);

  const isLoading = exercise === undefined || exerciseHistory === undefined;

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header
          title="Loading..."
          leftAction={
            <button type="button" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5 text-text-secondary" />
            </button>
          }
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  // Not found -- exercise may have been deleted but we can still use history data
  const exerciseName =
    exercise?.name ??
    (exerciseHistory && exerciseHistory.length > 0
      ? exerciseHistory[0].exerciseName
      : 'Unknown Exercise');

  // No data state
  if (!exerciseHistory || exerciseHistory.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header
          title={exerciseName}
          leftAction={
            <button type="button" onClick={() => router.back()} aria-label="Go back">
              <ArrowLeft className="h-5 w-5 text-text-secondary" />
            </button>
          }
        />
        <div className="flex flex-1 flex-col items-center justify-center px-4 text-text-muted">
          <TrendingUp className="mb-3 h-12 w-12" />
          <p className="text-lg font-medium">No history yet</p>
          <p className="mt-1 text-sm">
            Complete a workout with this exercise to see progress
          </p>
        </div>
      </div>
    );
  }

  // Summary stats
  const bestWeight = exerciseHistory.reduce(
    (max, e) => Math.max(max, e.bestWeightG),
    0,
  );
  const best1RM = exerciseHistory.reduce(
    (max, e) => Math.max(max, e.estimated1RM_G ?? 0),
    0,
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header
        title={exerciseName}
        leftAction={
          <button type="button" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
        }
      />

      <div className="flex-1 px-4 pb-8 pt-4">
        {/* Quick stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <Layers className="mx-auto mb-1 h-4 w-4 text-text-muted" />
            <p className="text-sm font-semibold text-text-primary">
              {exerciseHistory.length}
            </p>
            <p className="text-xs text-text-muted">Sessions</p>
          </Card>
          <Card padding="sm" className="text-center">
            <TrendingUp className="mx-auto mb-1 h-4 w-4 text-text-muted" />
            <p className="text-sm font-semibold text-text-primary">
              {formatWeightValue(bestWeight, unitSystem)} {unitSystem}
            </p>
            <p className="text-xs text-text-muted">Best Weight</p>
          </Card>
          <Card padding="sm" className="text-center">
            <TrendingUp className="mx-auto mb-1 h-4 w-4 text-accent" />
            <p className="text-sm font-semibold text-text-primary">
              {best1RM > 0
                ? `${formatWeightValue(best1RM, unitSystem)} ${unitSystem}`
                : '--'}
            </p>
            <p className="text-xs text-text-muted">Est. 1RM</p>
          </Card>
        </div>

        {/* Charts */}
        <div className="mb-4">
          <ProgressChart
            data={exerciseHistory}
            metric="1rm"
            title="Estimated 1RM"
          />
        </div>

        <div className="mb-4">
          <ProgressChart
            data={exerciseHistory}
            metric="volume"
            title="Total Volume"
          />
        </div>

        <div className="mb-6">
          <ProgressChart
            data={exerciseHistory}
            metric="weight"
            title="Best Weight"
          />
        </div>

        {/* Recent Sessions */}
        <section>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Recent Sessions
          </h3>
          <Card padding="sm">
            {recentSessions.map((entry) => (
              <SessionRow
                key={entry.id ?? `${entry.logId}-${entry.performedAt}`}
                entry={entry}
                unitSystem={unitSystem}
              />
            ))}
          </Card>
        </section>
      </div>
    </div>
  );
}
