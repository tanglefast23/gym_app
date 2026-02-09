'use client';

import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts';
import type { BmiChartPoint } from '@/lib/bmi';

export interface HealthyBmiRange {
  min: number;
  max: number;
}

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number | null }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const v = payload[0]?.value;
  if (v === null || v === undefined) return null;

  return (
    <div className="rounded-lg border border-border bg-elevated px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-primary">
        {v} BMI
        <span className="ml-2 text-xs font-medium text-text-muted">
          {bmiCategory(v)}
        </span>
      </p>
    </div>
  );
}

export function BmiChart({
  data,
  healthyRange,
  height = 140,
}: {
  data: BmiChartPoint[];
  healthyRange?: HealthyBmiRange | null;
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

  const domain = useMemo((): [number, number] => {
    const values = data
      .map((p) => p.value)
      .filter((v): v is number => v !== null && v !== undefined);

    if (values.length === 0) return [10, 40];

    const min = healthyRange ? Math.min(...values, healthyRange.min) : Math.min(...values);
    const max = healthyRange ? Math.max(...values, healthyRange.max) : Math.max(...values);
    const pad = 1.2;
    return [Math.max(0, Math.floor((min - pad) * 10) / 10), Math.ceil((max + pad) * 10) / 10];
  }, [data, healthyRange]);

  if (!hasAtLeastTwo) {
    return (
      <div
        className="flex items-center justify-center text-xs text-text-muted"
        style={{ height }}
      >
        Add at least 2 weight entries to see a chart
      </div>
    );
  }

  const x1 = data[0]?.label ?? '';
  const x2 = data[data.length - 1]?.label ?? '';
  const summaryText = `BMI chart with ${data.length} points.`;

  return (
    <div role="img" aria-label={summaryText} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
          {healthyRange ? (
            <ReferenceArea
              x1={x1}
              x2={x2}
              y1={healthyRange.min}
              y2={healthyRange.max}
              fill="var(--success, #22C55E)"
              fillOpacity={0.14}
              strokeOpacity={0}
            />
          ) : null}

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
            width={38}
            tickFormatter={(v: number) => `${v}`}
            domain={domain}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--color-teal, #4ECDC4)"
            strokeWidth={2}
            dot={false}
            activeDot={{
              r: 5,
              fill: 'var(--color-teal, #4ECDC4)',
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
