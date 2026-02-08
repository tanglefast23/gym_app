'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Clock, Layers, TrendingUp, Dumbbell } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { formatDuration, formatWeight, formatWeightValue } from '@/lib/calculations';
import { useSettingsStore } from '@/stores/settingsStore';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import type { PerformedSet } from '@/types/workout';

interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  sets: PerformedSet[];
}

/**
 * Groups performed sets by exerciseId, preserving the order they first appear.
 */
function groupSetsByExercise(sets: PerformedSet[]): ExerciseGroup[] {
  const groupMap = new Map<string, ExerciseGroup>();
  const orderedKeys: string[] = [];

  for (const set of sets) {
    const existing = groupMap.get(set.exerciseId);
    if (existing) {
      existing.sets.push(set);
    } else {
      orderedKeys.push(set.exerciseId);
      groupMap.set(set.exerciseId, {
        exerciseId: set.exerciseId,
        exerciseName: set.exerciseNameSnapshot,
        sets: [set],
      });
    }
  }

  return orderedKeys.map((key) => groupMap.get(key)!);
}

const detailDateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function formatDetailDate(isoString: string): string {
  return detailDateFormatter.format(new Date(isoString));
}

export default function LogDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  const log = useLiveQuery(
    () => db.logs.get(params.id).then((l) => l ?? null),
    [params.id],
  );

  const exerciseGroups = useMemo(
    () => (log ? groupSetsByExercise(log.performedSets) : []),
    [log],
  );

  // Loading state
  if (log === undefined) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header
          title="Loading..."
          centered
          leftAction={
            <button type="button" onClick={() => router.back()} aria-label="Go back" className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface">
              <ArrowLeft className="h-5 w-5" />
            </button>
          }
        />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </div>
    );
  }

  // Not found state
  if (log === null) {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <Header
          title="Not Found"
          centered
          leftAction={
            <button type="button" onClick={() => router.back()} aria-label="Go back" className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface">
              <ArrowLeft className="h-5 w-5" />
            </button>
          }
        />
        <div className="flex flex-1 flex-col items-center justify-center px-5 text-text-muted">
          <p className="text-lg font-medium">Workout not found</p>
          <p className="mt-1 text-sm">This log may have been deleted.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <Header
        title={formatDetailDate(log.startedAt)}
        centered
        leftAction={
          <button type="button" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft className="h-5 w-5 text-text-secondary" />
          </button>
        }
      />

      <div className="flex-1 px-5 pb-8 pt-4">
        {/* Template name + status */}
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-xl font-bold text-text-primary">
            {log.templateName}
          </h2>
          {log.status === 'partial' ? (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
              Partial
            </span>
          ) : null}
        </div>

        {/* Summary stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <Card padding="sm" className="text-center">
            <Clock className="mx-auto mb-1 h-4 w-4 text-text-muted" />
            <p className="text-sm font-semibold text-text-primary">
              {formatDuration(log.durationSec)}
            </p>
            <p className="text-xs text-text-muted">Duration</p>
          </Card>
          <Card padding="sm" className="text-center">
            <Layers className="mx-auto mb-1 h-4 w-4 text-text-muted" />
            <p className="text-sm font-semibold text-text-primary">
              {log.performedSets.length}
            </p>
            <p className="text-xs text-text-muted">Sets</p>
          </Card>
          <Card padding="sm" className="text-center">
            <TrendingUp className="mx-auto mb-1 h-4 w-4 text-text-muted" />
            <p className="text-sm font-semibold text-text-primary">
              {formatWeight(log.totalVolumeG, unitSystem)}
            </p>
            <p className="text-xs text-text-muted">Volume</p>
          </Card>
        </div>

        {/* Per-exercise breakdown */}
        {exerciseGroups.map((group) => (
          <section key={group.exerciseId} className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-accent" />
                <h3 className="font-semibold text-text-primary">
                  {group.exerciseName}
                </h3>
              </div>
              <Link
                href={`/history/exercise/${group.exerciseId}`}
                className="text-xs font-medium text-accent"
              >
                View Details
              </Link>
            </div>

            <Card padding="sm">
              {/* Table header */}
              <div className="mb-1 grid grid-cols-4 gap-2 text-xs font-medium text-text-muted">
                <span>Set</span>
                <span>Weight</span>
                <span>Reps</span>
                <span className="text-right">Volume</span>
              </div>

              {/* Set rows */}
              {group.sets.map((set, idx) => {
                const setVolume = set.weightG * set.repsDone;
                return (
                  <div
                    key={`${set.exerciseId}-${set.setIndex}-${idx}`}
                    className="grid grid-cols-4 gap-2 border-t border-border py-1.5 text-sm text-text-secondary"
                  >
                    <span className="text-text-muted">{set.setIndex + 1}</span>
                    <span>{formatWeightValue(set.weightG, unitSystem)} {unitSystem}</span>
                    <span>{set.repsDone}</span>
                    <span className="text-right">
                      {formatWeight(setVolume, unitSystem)}
                    </span>
                  </div>
                );
              })}
            </Card>
          </section>
        ))}
      </div>
    </div>
  );
}
