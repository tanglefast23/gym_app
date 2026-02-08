'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { gramsToKg, gramsToLb } from '@/lib/calculations';
import type { ExerciseHistoryEntry } from '@/types/workout';
import type { UnitSystem } from '@/types/workout';

interface ProgressChartContentProps {
  data: ExerciseHistoryEntry[];
  metric: '1rm' | 'volume' | 'weight';
  unitSystem: UnitSystem;
}

interface ChartDataPoint {
  date: string;
  value: number;
}

/**
 * Formats a date string to MM/DD for the X-axis.
 */
function formatDateAxis(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/**
 * Converts grams to the display unit value.
 */
function convertToDisplayUnit(grams: number, unit: UnitSystem): number {
  const value = unit === 'kg' ? gramsToKg(grams) : gramsToLb(grams);
  return Math.round(value * 10) / 10;
}

/**
 * Returns the unit suffix for display.
 */
function unitSuffix(unit: UnitSystem): string {
  return unit === 'kg' ? 'kg' : 'lbs';
}

/**
 * Transforms raw exercise history data into chart data points
 * based on the selected metric.
 */
function transformData(
  data: ExerciseHistoryEntry[],
  metric: '1rm' | 'volume' | 'weight',
  unit: UnitSystem,
): ChartDataPoint[] {
  return data
    .filter((entry) => {
      if (metric === '1rm') return entry.estimated1RM_G !== null;
      return true;
    })
    .map((entry) => {
      let rawValue: number;
      switch (metric) {
        case '1rm':
          rawValue = entry.estimated1RM_G ?? 0;
          break;
        case 'volume':
          rawValue = entry.totalVolumeG;
          break;
        case 'weight':
          rawValue = entry.bestWeightG;
          break;
      }
      return {
        date: formatDateAxis(entry.performedAt),
        value: convertToDisplayUnit(rawValue, unit),
      };
    });
}

/**
 * Custom tooltip for the chart with dark theme styling.
 */
function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  unit: UnitSystem;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-primary">
        {payload[0].value} {unitSuffix(unit)}
      </p>
    </div>
  );
}

/**
 * The actual chart content that gets lazy loaded.
 * Renders a Recharts LineChart styled for the dark theme.
 */
const ProgressChartContent = ({
  data,
  metric,
  unitSystem,
}: ProgressChartContentProps) => {
  const chartData = transformData(data, metric, unitSystem);

  if (chartData.length < 2) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-text-muted">
        Need at least 2 sessions to show a chart
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={256}>
      <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 0 }}>
        <XAxis
          dataKey="date"
          stroke="#6B6B70"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="#6B6B70"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={45}
          tickFormatter={(v: number) => `${v}`}
        />
        <Tooltip
          content={
            <CustomTooltip unit={unitSystem} />
          }
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#6366F1"
          strokeWidth={2}
          dot={{ r: 4, fill: '#6366F1', stroke: '#111113', strokeWidth: 2 }}
          activeDot={{ r: 6, fill: '#6366F1', stroke: '#FFFFFF', strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default ProgressChartContent;
