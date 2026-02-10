'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { UnitSystem } from '@/types/workout';

export interface BodyWeightChartPoint {
  label: string;
  value: number | null;
}

function unitSuffix(unit: UnitSystem): string {
  return unit === 'kg' ? 'kg' : 'lbs';
}

function CustomTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null }>;
  label?: string;
  unit: UnitSystem;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const v = payload[0]?.value;
  if (v === null || v === undefined) return null;

  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-primary">
        {v} {unitSuffix(unit)}
      </p>
    </div>
  );
}

export function BodyWeightChart({
  data,
  unitSystem,
  height = 140,
}: {
  data: BodyWeightChartPoint[];
  unitSystem: UnitSystem;
  height?: number;
}) {
  const hasAtLeastTwo = useMemo(() => {
    let count = 0;
    for (const p of data) {
      if (p.value != null) count++;
      if (count >= 2) return true;
    }
    return false;
  }, [data]);

  if (!hasAtLeastTwo) {
    return (
      <div
        className="flex items-center justify-center text-xs text-text-muted"
        style={{ height }}
      >
        Add at least 2 entries to see a chart
      </div>
    );
  }

  const summaryText = `Body weight chart with ${data.length} points.`;

  return (
    <div role="img" aria-label={summaryText} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
          <XAxis
            dataKey="label"
            stroke="var(--text-muted, #6B6B70)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            stroke="var(--text-muted, #6B6B70)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={['auto', 'auto']}
            tickCount={5}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip content={<CustomTooltip unit={unitSystem} />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--accent, #F59E0B)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 5,
              fill: 'var(--accent, #F59E0B)',
              stroke: 'var(--text-primary, #FFFFFF)',
              strokeWidth: 2,
            }}
            connectNulls
            isAnimationActive
            animationDuration={700}
            animationEasing="ease-out"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
