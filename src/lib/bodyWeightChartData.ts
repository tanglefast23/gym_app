import { formatWeightValue } from '@/lib/calculations';
import { latestPerDay } from '@/lib/bodyWeight';
import type { BodyWeightEntry, UnitSystem } from '@/types/workout';
import type { WeightTimeline } from '@/types/weight';

export interface BodyWeightChartPoint {
  label: string;
  value: number | null;
}

export function buildBodyWeightChartData(
  entries: BodyWeightEntry[],
  timeline: WeightTimeline,
  unit: UnitSystem,
): BodyWeightChartPoint[] {
  const byDay = latestPerDay(entries);
  const today = new Date();

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

    const points: BodyWeightChartPoint[] = [];
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
  // month: last 30 days
  const days = timeline === 'month' ? 30 : 7;
  const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));
  const points: BodyWeightChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
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

