import { latestPerDay } from '@/lib/bodyWeight';
import type { BodyWeightEntry } from '@/types/workout';
import type { WeightTimeline } from '@/types/weight';

export interface BmiChartPoint {
  label: string;
  value: number | null;
}

export function computeBmi(weightG: number, heightCm: number): number {
  const kg = weightG / 1000;
  const m = heightCm / 100;
  const bmi = kg / (m * m);
  return Math.round(bmi * 10) / 10;
}

/**
 * Build chart-ready BMI points from body weight entries.
 * Produces one point per time bucket (day or month) with `null` for missing data.
 */
export function buildBmiChartData(
  entries: BodyWeightEntry[],
  heightCm: number,
  timeline: WeightTimeline,
): BmiChartPoint[] {
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

    const points: BmiChartPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const e = monthMap.get(key);
      points.push({
        label: `${String(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
        value: e ? computeBmi(e.weightG, heightCm) : null,
      });
    }
    return points;
  }

  // week: last 7 days
  // month: last 30 days
  const days = timeline === 'month' ? 30 : 7;
  const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));
  const points: BmiChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const e = values.get(k);
    points.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: e ? computeBmi(e.weightG, heightCm) : null,
    });
  }
  return points;
}

