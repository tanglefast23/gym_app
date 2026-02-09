import { gramsToKg, gramsToLb, formatWeightValue } from '@/lib/calculations';
import type { BodyWeightEntry, UnitSystem } from '@/types/workout';
import type { WeightTimeline } from '@/types/weight';

export function localDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function displayBodyWeight(grams: number, unit: UnitSystem): number {
  const v = unit === 'kg' ? gramsToKg(grams) : gramsToLb(grams);
  return Math.round(v * 10) / 10;
}

/**
 * One-entry-per-day canonical series: keep the latest entry for each local date.
 * Returned array is sorted by dateKey ascending.
 */
export function latestPerDay(entries: BodyWeightEntry[]): Array<{ dateKey: string; entry: BodyWeightEntry }> {
  const map = new Map<string, BodyWeightEntry>();
  for (const e of entries) {
    const key = localDateKey(new Date(e.recordedAt));
    const existing = map.get(key);
    if (!existing || e.recordedAt > existing.recordedAt) {
      map.set(key, e);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([dateKey, entry]) => ({ dateKey, entry }));
}

// ---------------------------------------------------------------------------
// Chart data builder (shared between progress and weight pages)
// ---------------------------------------------------------------------------

export interface BodyWeightChartPoint {
  label: string;
  value: number | null;
}

/**
 * Build chart-ready data points from body weight entries.
 * Produces one point per time bucket (day or month) with `null` for missing data.
 */
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

