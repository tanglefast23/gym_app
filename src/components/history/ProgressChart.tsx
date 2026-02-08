'use client';

import dynamic from 'next/dynamic';
import type { ExerciseHistoryEntry } from '@/types/workout';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Lazy load the chart content to keep the initial bundle small.
 * Recharts is a large library that should only load when needed.
 */
const ChartContent = dynamic(() => import('./ProgressChartContent'), {
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  ),
  ssr: false,
});

interface ProgressChartProps {
  data: ExerciseHistoryEntry[];
  metric: '1rm' | 'volume' | 'weight';
  title: string;
}

/**
 * Wrapper component for the exercise progress chart.
 * Dynamically imports the Recharts-based chart content with a loading spinner.
 */
export const ProgressChart = ({ data, metric, title }: ProgressChartProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      <ChartContent data={data} metric={metric} unitSystem={unitSystem} />
    </div>
  );
};
