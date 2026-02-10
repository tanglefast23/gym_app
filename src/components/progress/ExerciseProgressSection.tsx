'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { formatWeightValue } from '@/lib/calculations';
import { ProgressChart } from '@/components/history/ProgressChart';
import { EmptyState } from '@/components/ui/EmptyState';
import type { ExerciseHistoryEntry, UnitSystem } from '@/types/workout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExerciseGroup {
  exerciseId: string;
  exerciseName: string;
  entries: ExerciseHistoryEntry[];
  latestBestWeightG: number;
  totalSessions: number;
}

interface ExerciseProgressSectionProps {
  exerciseGroups: ExerciseGroup[];
  unitSystem: UnitSystem;
}

// ---------------------------------------------------------------------------
// ExerciseProgressCard (internal)
// ---------------------------------------------------------------------------

function ExerciseProgressCard({
  group,
  unitSystem,
}: {
  group: ExerciseGroup;
  unitSystem: UnitSystem;
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
              {group.totalSessions} session{group.totalSessions !== 1 ? 's' : ''} · Best:{' '}
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
// ExerciseProgressSection
// ---------------------------------------------------------------------------

const INITIAL_COUNT = 5;

export function ExerciseProgressSection({
  exerciseGroups,
  unitSystem,
}: ExerciseProgressSectionProps) {
  const [showAll, setShowAll] = useState(false);

  if (exerciseGroups.length === 0) {
    return (
      <EmptyState
        illustrationSrc="/visuals/empty/empty-progress.svg"
        illustrationAlt=""
        title="Progress starts on day one"
        description="Complete two sessions of the same exercise to unlock your first chart."
      />
    );
  }

  const visibleGroups = showAll
    ? exerciseGroups
    : exerciseGroups.slice(0, INITIAL_COUNT);

  const hasMore = exerciseGroups.length > INITIAL_COUNT;

  return (
    <section className="mb-6 animate-fade-in-up stagger-4">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
        EXERCISE PROGRESS
      </h2>
      <div className="space-y-4">
        {visibleGroups.map((group, i) => (
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
      {hasMore && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors active:bg-elevated"
        >
          <ChevronDown className="h-4 w-4" />
          Show all {exerciseGroups.length} exercises
        </button>
      ) : null}
    </section>
  );
}
