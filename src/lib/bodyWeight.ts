import { gramsToKg, gramsToLb } from '@/lib/calculations';
import type { BodyWeightEntry, UnitSystem } from '@/types/workout';

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

