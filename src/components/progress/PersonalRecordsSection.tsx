'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Trophy, ChevronRight, ChevronDown } from 'lucide-react';
import { formatWeight } from '@/lib/calculations';
import type { UnitSystem } from '@/types/workout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExercisePR {
  exerciseId: string;
  exerciseName: string;
  bestWeightG: number;
  bestWeightDate: string;
  best1RM_G: number | null;
  best1RMDate: string | null;
  bestVolumeG: number;
  bestVolumeDate: string;
}

interface PersonalRecordsSectionProps {
  personalRecords: ExercisePR[];
  unitSystem: UnitSystem;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// PRCard (internal)
// ---------------------------------------------------------------------------

function PRCard({
  pr,
  unitSystem,
}: {
  pr: ExercisePR;
  unitSystem: UnitSystem;
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
// PersonalRecordsSection
// ---------------------------------------------------------------------------

const INITIAL_COUNT = 5;

export function PersonalRecordsSection({
  personalRecords,
  unitSystem,
}: PersonalRecordsSectionProps) {
  const [showAll, setShowAll] = useState(false);

  if (personalRecords.length === 0) return null;

  const visibleRecords = showAll
    ? personalRecords
    : personalRecords.slice(0, INITIAL_COUNT);

  const hasMore = personalRecords.length > INITIAL_COUNT;

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
        <Trophy className="h-3.5 w-3.5" />
        PERSONAL RECORDS
      </h2>
      <div className="space-y-3">
        {visibleRecords.map((pr) => (
          <PRCard
            key={pr.exerciseId}
            pr={pr}
            unitSystem={unitSystem}
          />
        ))}
      </div>
      {hasMore && !showAll ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text-secondary transition-colors active:bg-elevated"
        >
          <ChevronDown className="h-4 w-4" />
          Show all {personalRecords.length} exercises
        </button>
      ) : null}
    </section>
  );
}
