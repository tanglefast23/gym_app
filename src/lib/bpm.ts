import { localDateKey } from '@/lib/bodyWeight';
import type { BpmEntry } from '@/types/workout';
import type { WeightTimeline } from '@/types/weight';

export interface BpmChartPoint {
  label: string;
  value: number | null;
}

/**
 * One-entry-per-day canonical series: keep the latest entry for each local date.
 * Returned array is sorted by dateKey ascending.
 */
export function latestBpmPerDay(entries: BpmEntry[]): Array<{ dateKey: string; entry: BpmEntry }> {
  const map = new Map<string, BpmEntry>();
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

/**
 * Build chart-ready data points from BPM entries.
 * Produces one point per time bucket (day or month) with `null` for missing data.
 */
export function buildBpmChartData(
  entries: BpmEntry[],
  timeline: WeightTimeline,
): BpmChartPoint[] {
  const byDay = latestBpmPerDay(entries);
  const today = new Date();

  if (timeline === 'year') {
    // Last 12 months, monthly latest.
    const monthMap = new Map<string, BpmEntry>();
    for (const { dateKey, entry } of byDay) {
      const monthKey = dateKey.slice(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey);
      if (!existing || entry.recordedAt > existing.recordedAt) {
        monthMap.set(monthKey, entry);
      }
    }

    const points: BpmChartPoint[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const e = monthMap.get(key);
      points.push({
        label: `${String(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
        value: e ? e.bpm : null,
      });
    }
    return points;
  }

  // week: last 7 days
  // month: last 30 days
  const days = timeline === 'month' ? 30 : 7;
  const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));
  const points: BpmChartPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const e = values.get(k);
    points.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: e ? e.bpm : null,
    });
  }
  return points;
}

