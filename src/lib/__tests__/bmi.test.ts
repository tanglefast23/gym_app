import { describe, it, expect } from 'vitest';
import { computeBmi, buildBmiChartData } from '@/lib/bmi';

describe('computeBmi', () => {
  it('computes BMI from grams and height cm', () => {
    // 80 kg, 1.80 m => 24.69...
    expect(computeBmi(80_000, 180)).toBe(24.7);
  });
});

describe('buildBmiChartData', () => {
  it('builds week series with 7 points', () => {
    const heightCm = 180;
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const iso = `${y}-${m}-${d}T08:00:00.000Z`;

    const data = buildBmiChartData(
      [{ id: `${y}-${m}-${d}`, recordedAt: iso, weightG: 80_000 }],
      heightCm,
      'week',
    );

    expect(data).toHaveLength(7);
    // Today should be the last point
    expect(data[data.length - 1].value).toBe(24.7);
  });
});

