import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  localDateKey,
  displayBodyWeight,
  latestPerDay,
  buildBodyWeightChartData,
} from '../bodyWeight';
import type { BodyWeightEntry } from '@/types/workout';

// ---------------------------------------------------------------------------
// localDateKey
// ---------------------------------------------------------------------------

describe('localDateKey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2025, 0, 15); // January 15, 2025 (local)
    expect(localDateKey(d)).toBe('2025-01-15');
  });

  it('zero-pads single-digit month and day', () => {
    const d = new Date(2025, 2, 5); // March 5, 2025
    expect(localDateKey(d)).toBe('2025-03-05');
  });

  it('handles December 31', () => {
    const d = new Date(2025, 11, 31); // December 31, 2025
    expect(localDateKey(d)).toBe('2025-12-31');
  });

  it('handles January 1', () => {
    const d = new Date(2026, 0, 1); // January 1, 2026
    expect(localDateKey(d)).toBe('2026-01-01');
  });
});

// ---------------------------------------------------------------------------
// displayBodyWeight
// ---------------------------------------------------------------------------

describe('displayBodyWeight', () => {
  it('converts grams to kg with one decimal', () => {
    expect(displayBodyWeight(80500, 'kg')).toBe(80.5);
  });

  it('converts grams to lb with one decimal', () => {
    // 80000g / 453.592 = 176.37... -> rounded to 176.4
    const result = displayBodyWeight(80000, 'lb');
    expect(result).toBeCloseTo(176.4, 1);
  });

  it('returns whole number for round kg values', () => {
    expect(displayBodyWeight(80000, 'kg')).toBe(80);
  });
});

// ---------------------------------------------------------------------------
// latestPerDay
// ---------------------------------------------------------------------------

describe('latestPerDay', () => {
  it('returns one entry per day sorted ascending', () => {
    const entries: BodyWeightEntry[] = [
      { id: 'bw-1', recordedAt: '2025-06-01T08:00:00Z', weightG: 80000 },
      { id: 'bw-2', recordedAt: '2025-06-02T09:00:00Z', weightG: 81000 },
    ];

    const result = latestPerDay(entries);
    expect(result).toHaveLength(2);
    expect(result[0].dateKey).toBe('2025-06-01');
    expect(result[1].dateKey).toBe('2025-06-02');
  });

  it('keeps only the latest entry when multiple entries exist on the same day', () => {
    // Use timestamps that fall on the same local date regardless of timezone (up to UTC+14).
    // All times between 00:00 and 14:00 UTC on June 2 will be June 2 local in UTC+0..UTC+14.
    const entries: BodyWeightEntry[] = [
      { id: 'bw-1', recordedAt: '2025-06-02T01:00:00Z', weightG: 80000 },
      { id: 'bw-2', recordedAt: '2025-06-02T06:00:00Z', weightG: 79500 },
      { id: 'bw-3', recordedAt: '2025-06-02T03:00:00Z', weightG: 80200 },
    ];

    const result = latestPerDay(entries);
    expect(result).toHaveLength(1);
    // The latest recordedAt is '2025-06-02T06:00:00Z' (ISO string comparison)
    expect(result[0].entry.id).toBe('bw-2');
    expect(result[0].entry.weightG).toBe(79500);
  });

  it('returns empty array for empty input', () => {
    expect(latestPerDay([])).toEqual([]);
  });

  it('handles entries across many days and returns sorted', () => {
    const entries: BodyWeightEntry[] = [
      { id: 'bw-3', recordedAt: '2025-06-03T10:00:00Z', weightG: 82000 },
      { id: 'bw-1', recordedAt: '2025-06-01T10:00:00Z', weightG: 80000 },
      { id: 'bw-2', recordedAt: '2025-06-02T10:00:00Z', weightG: 81000 },
    ];

    const result = latestPerDay(entries);
    expect(result).toHaveLength(3);
    // Verify ascending date order
    expect(result[0].dateKey).toBe('2025-06-01');
    expect(result[1].dateKey).toBe('2025-06-02');
    expect(result[2].dateKey).toBe('2025-06-03');
  });
});

// ---------------------------------------------------------------------------
// buildBodyWeightChartData
// ---------------------------------------------------------------------------

describe('buildBodyWeightChartData', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('week timeline', () => {
    it('returns 7 data points', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 7)); // June 7, 2025

      const entries: BodyWeightEntry[] = [];
      const result = buildBodyWeightChartData(entries, 'week', 'kg');
      expect(result).toHaveLength(7);
    });

    it('fills in null for days without data', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 7)); // June 7, 2025

      const entries: BodyWeightEntry[] = [
        { id: 'bw-1', recordedAt: '2025-06-07T08:00:00Z', weightG: 80000 },
      ];

      const result = buildBodyWeightChartData(entries, 'week', 'kg');
      // Only today (June 7) should have a value
      const nonNull = result.filter((p) => p.value !== null);
      expect(nonNull.length).toBe(1);
      expect(nonNull[0].value).toBe(80);

      // The rest should be null
      const nullPoints = result.filter((p) => p.value === null);
      expect(nullPoints.length).toBe(6);
    });

    it('labels use month/day format', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 7)); // June 7, 2025

      const result = buildBodyWeightChartData([], 'week', 'kg');
      // Last point should be today: 6/7
      expect(result[result.length - 1].label).toBe('6/7');
    });
  });

  describe('month timeline', () => {
    it('returns 30 data points', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 15, 2025

      const result = buildBodyWeightChartData([], 'month', 'kg');
      expect(result).toHaveLength(30);
    });

    it('includes correct values for days with entries', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 15, 2025

      const entries: BodyWeightEntry[] = [
        { id: 'bw-1', recordedAt: '2025-06-15T08:00:00Z', weightG: 75000 },
        { id: 'bw-2', recordedAt: '2025-06-14T08:00:00Z', weightG: 75500 },
      ];

      const result = buildBodyWeightChartData(entries, 'month', 'kg');
      const today = result[result.length - 1];
      const yesterday = result[result.length - 2];

      expect(today.value).toBe(75);
      expect(yesterday.value).toBe(75.5);
    });
  });

  describe('year timeline', () => {
    it('returns 12 data points (one per month)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 15, 2025

      const result = buildBodyWeightChartData([], 'year', 'kg');
      expect(result).toHaveLength(12);
    });

    it('labels use month/year format', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 15, 2025

      const result = buildBodyWeightChartData([], 'year', 'kg');
      // Last point should be current month: 6/25
      expect(result[result.length - 1].label).toBe('6/25');
      // First point should be 12 months ago: 7/24
      expect(result[0].label).toBe('7/24');
    });

    it('uses the latest entry per month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 15, 2025

      const entries: BodyWeightEntry[] = [
        { id: 'bw-1', recordedAt: '2025-06-01T08:00:00Z', weightG: 80000 },
        { id: 'bw-2', recordedAt: '2025-06-10T08:00:00Z', weightG: 79000 },
      ];

      const result = buildBodyWeightChartData(entries, 'year', 'kg');
      const junePoint = result[result.length - 1];
      // Latest entry in June is bw-2 (June 10 > June 1), weightG=79000 -> 79 kg
      expect(junePoint.value).toBe(79);
    });

    it('fills null for months without data', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 15, 2025

      const entries: BodyWeightEntry[] = [
        { id: 'bw-1', recordedAt: '2025-06-10T08:00:00Z', weightG: 80000 },
      ];

      const result = buildBodyWeightChartData(entries, 'year', 'kg');
      // Only June should have a value
      const nonNull = result.filter((p) => p.value !== null);
      expect(nonNull.length).toBe(1);
      const nullPoints = result.filter((p) => p.value === null);
      expect(nullPoints.length).toBe(11);
    });
  });

  describe('unit conversion', () => {
    it('converts to lbs when unit is lb', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 7)); // June 7, 2025

      const entries: BodyWeightEntry[] = [
        { id: 'bw-1', recordedAt: '2025-06-07T08:00:00Z', weightG: 80000 },
      ];

      const result = buildBodyWeightChartData(entries, 'week', 'lb');
      const todayPoint = result[result.length - 1];
      // 80000g / 453.592 = ~176.4 lbs
      expect(todayPoint.value).not.toBeNull();
      expect(todayPoint.value!).toBeGreaterThan(170);
      expect(todayPoint.value!).toBeLessThan(180);
    });
  });
});
