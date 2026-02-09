'use client';

import {
  TrendingUp,
  Dumbbell,
  Calendar,
  Clock,
  Timer,
} from 'lucide-react';
import { formatDuration } from '@/lib/calculations';
import { Card } from '@/components/ui/Card';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StatsSectionProps {
  totalWorkouts: number;
  weekWorkouts: number;
  totalExercises: number;
  avgDurationSec: number;
  totalTimeSec: number;
}

// ---------------------------------------------------------------------------
// StatCard (internal)
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
// StatsSection
// ---------------------------------------------------------------------------

export function StatsSection({
  totalWorkouts,
  weekWorkouts,
  totalExercises,
  avgDurationSec,
  totalTimeSec,
}: StatsSectionProps) {
  return (
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

      {/* Duration Stats */}
      {totalWorkouts > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3">
          <StatCard
            icon={Timer}
            value={formatDuration(avgDurationSec)}
            label="Avg Duration"
          />
          <StatCard
            icon={Clock}
            value={formatDuration(totalTimeSec)}
            label="Total Time"
          />
        </div>
      ) : null}
    </>
  );
}
