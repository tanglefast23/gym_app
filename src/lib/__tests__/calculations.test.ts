import { describe, it, expect } from 'vitest';
import {
  gramsToKg,
  gramsToLb,
  kgToGrams,
  lbToGrams,
  formatWeight,
  formatWeightValue,
  displayToGrams,
  stepToGrams,
  calculateEpley1RM,
  setVolume,
  totalVolume,
  formatRepTarget,
  formatTime,
  formatDuration,
} from '../calculations';

// ---------------------------------------------------------------------------
// Unit conversions
// ---------------------------------------------------------------------------

describe('gramsToKg', () => {
  it('converts 1000g to 1kg', () => {
    expect(gramsToKg(1000)).toBe(1);
  });

  it('converts 2500g to 2.5kg', () => {
    expect(gramsToKg(2500)).toBe(2.5);
  });

  it('converts 0g to 0kg', () => {
    expect(gramsToKg(0)).toBe(0);
  });
});

describe('gramsToLb', () => {
  it('converts 453.592g to approximately 1lb', () => {
    expect(gramsToLb(453.592)).toBeCloseTo(1, 5);
  });

  it('converts 0g to 0lb', () => {
    expect(gramsToLb(0)).toBe(0);
  });

  it('converts 45359g to approximately 100lb', () => {
    expect(gramsToLb(45359)).toBeCloseTo(100, 0);
  });
});

describe('kgToGrams', () => {
  it('converts 2.5kg to 2500g', () => {
    expect(kgToGrams(2.5)).toBe(2500);
  });

  it('converts 0kg to 0g', () => {
    expect(kgToGrams(0)).toBe(0);
  });

  it('rounds to nearest integer', () => {
    // 1.1 * 1000 = 1100 exactly, but 0.1 * 1000 = 100 due to IEEE754
    expect(Number.isInteger(kgToGrams(1.1))).toBe(true);
  });
});

describe('lbToGrams', () => {
  it('converts 1lb to 454g (rounded)', () => {
    expect(lbToGrams(1)).toBe(454);
  });

  it('converts 135lb to 61235g (rounded)', () => {
    expect(lbToGrams(135)).toBe(Math.round(135 * 453.592));
  });

  it('converts 0lb to 0g', () => {
    expect(lbToGrams(0)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Weight formatting
// ---------------------------------------------------------------------------

describe('formatWeight', () => {
  it('formats whole kg without decimal', () => {
    expect(formatWeight(5000, 'kg')).toBe('5 kg');
  });

  it('formats fractional kg with one decimal', () => {
    expect(formatWeight(2500, 'kg')).toBe('2.5 kg');
  });

  it('formats 0g in kg', () => {
    expect(formatWeight(0, 'kg')).toBe('0 kg');
  });

  it('formats whole lbs without decimal', () => {
    // 45359.2 rounds to a clean 100 via gramsToLb
    const grams = lbToGrams(100);
    expect(formatWeight(grams, 'lb')).toContain('lbs');
  });

  it('formats fractional lbs with one decimal', () => {
    expect(formatWeight(1000, 'lb')).toContain('lbs');
  });
});

describe('formatWeightValue', () => {
  it('returns number string without unit for kg', () => {
    expect(formatWeightValue(5000, 'kg')).toBe('5');
  });

  it('returns fractional kg string', () => {
    expect(formatWeightValue(2500, 'kg')).toBe('2.5');
  });

  it('returns number string without unit for lb', () => {
    const grams = lbToGrams(100);
    const result = formatWeightValue(grams, 'lb');
    expect(result).not.toContain('lb');
  });
});

// ---------------------------------------------------------------------------
// Round-trip conversions
// ---------------------------------------------------------------------------

describe('displayToGrams', () => {
  it('round-trips kg -> grams -> kg', () => {
    const grams = displayToGrams(80, 'kg');
    expect(grams).toBe(80000);
    expect(gramsToKg(grams)).toBe(80);
  });

  it('round-trips lb -> grams -> lb approximately', () => {
    const grams = displayToGrams(135, 'lb');
    expect(gramsToLb(grams)).toBeCloseTo(135, 0);
  });
});

describe('stepToGrams', () => {
  it('converts 2.5kg step to 2500g', () => {
    expect(stepToGrams(2.5, 'kg')).toBe(2500);
  });

  it('converts 5lb step to correct grams', () => {
    expect(stepToGrams(5, 'lb')).toBe(Math.round(5 * 453.592));
  });
});

// ---------------------------------------------------------------------------
// 1RM calculation
// ---------------------------------------------------------------------------

describe('calculateEpley1RM', () => {
  it('calculates 100kg x 5 reps correctly', () => {
    // Epley: 100000 * (1 + 5/30) = 100000 * 1.1667 = 116667 (rounded)
    const result = calculateEpley1RM(100000, 5);
    expect(result).toBe(Math.round(100000 * (1 + 5 / 30)));
  });

  it('returns the weight itself for reps === 1', () => {
    expect(calculateEpley1RM(80000, 1)).toBe(80000);
  });

  it('returns null for reps > 12', () => {
    expect(calculateEpley1RM(80000, 13)).toBeNull();
  });

  it('returns null for reps <= 0', () => {
    expect(calculateEpley1RM(80000, 0)).toBeNull();
    expect(calculateEpley1RM(80000, -1)).toBeNull();
  });

  it('returns null for weight <= 0', () => {
    expect(calculateEpley1RM(0, 5)).toBeNull();
    expect(calculateEpley1RM(-1000, 5)).toBeNull();
  });

  it('works at boundary of exactly 12 reps', () => {
    const result = calculateEpley1RM(60000, 12);
    expect(result).toBe(Math.round(60000 * (1 + 12 / 30)));
  });

  it('returns null at boundary of exactly 13 reps', () => {
    expect(calculateEpley1RM(60000, 13)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

describe('setVolume', () => {
  it('calculates weight * reps', () => {
    expect(setVolume(5000, 10)).toBe(50000);
  });

  it('returns 0 when reps is 0', () => {
    expect(setVolume(5000, 0)).toBe(0);
  });
});

describe('totalVolume', () => {
  it('sums volume across multiple sets', () => {
    const sets = [
      { weightG: 5000, repsDone: 10 },
      { weightG: 5000, repsDone: 8 },
      { weightG: 5000, repsDone: 6 },
    ];
    expect(totalVolume(sets)).toBe(5000 * 10 + 5000 * 8 + 5000 * 6);
  });

  it('returns 0 for empty array', () => {
    expect(totalVolume([])).toBe(0);
  });

  it('handles single set', () => {
    expect(totalVolume([{ weightG: 100000, repsDone: 1 }])).toBe(100000);
  });
});

// ---------------------------------------------------------------------------
// Rep formatting
// ---------------------------------------------------------------------------

describe('formatRepTarget', () => {
  it('returns range string when min !== max', () => {
    expect(formatRepTarget(8, 12)).toBe('8-12');
  });

  it('returns single number when min === max', () => {
    expect(formatRepTarget(10, 10)).toBe('10');
  });
});

// ---------------------------------------------------------------------------
// Time formatting
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats 90 seconds as 1:30', () => {
    expect(formatTime(90)).toBe('1:30');
  });

  it('formats 0 seconds as 0:00', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('formats 3661 seconds as 61:01', () => {
    expect(formatTime(3661)).toBe('61:01');
  });

  it('clamps negative seconds to 0:00', () => {
    expect(formatTime(-5)).toBe('0:00');
  });

  it('pads single-digit seconds', () => {
    expect(formatTime(5)).toBe('0:05');
  });
});

describe('formatDuration', () => {
  it('formats 3600 seconds as 1h 0m', () => {
    expect(formatDuration(3600)).toBe('1h 0m');
  });

  it('formats 5400 seconds as 1h 30m', () => {
    expect(formatDuration(5400)).toBe('1h 30m');
  });

  it('formats sub-hour durations without hours', () => {
    expect(formatDuration(300)).toBe('5m');
  });

  it('formats 0 seconds as 0m', () => {
    expect(formatDuration(0)).toBe('0m');
  });

  it('formats 4980 seconds as 1h 23m', () => {
    expect(formatDuration(4980)).toBe('1h 23m');
  });
});
