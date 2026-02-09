import { describe, it, expect } from 'vitest';
import { autoIncrementAge } from '@/lib/age';

describe('autoIncrementAge', () => {
  // ---------------------------------------------------------------------------
  // Null / missing inputs
  // ---------------------------------------------------------------------------

  it('returns null when age is null', () => {
    const result = autoIncrementAge({
      age: null,
      ageUpdatedAt: '2025-01-01T00:00:00.000Z',
    });
    expect(result).toEqual({ age: null, ageUpdatedAt: null });
  });

  it('stamps now when ageUpdatedAt is null', () => {
    const now = new Date('2025-06-15T12:00:00.000Z');
    const result = autoIncrementAge({ age: 30, ageUpdatedAt: null, now });
    expect(result.age).toBe(30);
    expect(result.ageUpdatedAt).toBe(now.toISOString());
  });

  it('stamps now when ageUpdatedAt is an invalid date string', () => {
    const now = new Date('2025-06-15T12:00:00.000Z');
    const result = autoIncrementAge({
      age: 25,
      ageUpdatedAt: 'not-a-date',
      now,
    });
    expect(result.age).toBe(25);
    expect(result.ageUpdatedAt).toBe(now.toISOString());
  });

  // ---------------------------------------------------------------------------
  // No increment (< 365 days)
  // ---------------------------------------------------------------------------

  it('does not increment when less than 365 days have passed', () => {
    const base = '2025-01-01T00:00:00.000Z';
    const now = new Date('2025-06-01T00:00:00.000Z'); // ~151 days
    const result = autoIncrementAge({ age: 30, ageUpdatedAt: base, now });
    expect(result.age).toBe(30);
    expect(result.ageUpdatedAt).toBe(base);
  });

  it('does not increment at exactly 364 days', () => {
    const base = '2025-01-01T00:00:00.000Z';
    const d = new Date(new Date(base).getTime() + 364 * 24 * 60 * 60 * 1000);
    const result = autoIncrementAge({ age: 28, ageUpdatedAt: base, now: d });
    expect(result.age).toBe(28);
  });

  // ---------------------------------------------------------------------------
  // Single year crossing
  // ---------------------------------------------------------------------------

  it('increments by 1 at exactly 365 days', () => {
    const base = '2025-01-01T00:00:00.000Z';
    const d = new Date(new Date(base).getTime() + 365 * 24 * 60 * 60 * 1000);
    const result = autoIncrementAge({ age: 30, ageUpdatedAt: base, now: d });
    expect(result.age).toBe(31);
  });

  it('increments by 1 at ~400 days (still < 2 years)', () => {
    const base = '2025-01-01T00:00:00.000Z';
    const d = new Date(new Date(base).getTime() + 400 * 24 * 60 * 60 * 1000);
    const result = autoIncrementAge({ age: 30, ageUpdatedAt: base, now: d });
    expect(result.age).toBe(31);
  });

  // ---------------------------------------------------------------------------
  // Multi-year gap
  // ---------------------------------------------------------------------------

  it('increments by 3 when ~3 years have passed', () => {
    const base = '2022-01-01T00:00:00.000Z';
    const d = new Date(
      new Date(base).getTime() + 3 * 365 * 24 * 60 * 60 * 1000 + 10 * 24 * 60 * 60 * 1000,
    );
    const result = autoIncrementAge({ age: 25, ageUpdatedAt: base, now: d });
    expect(result.age).toBe(28);
  });

  // ---------------------------------------------------------------------------
  // ageUpdatedAt advancement
  // ---------------------------------------------------------------------------

  it('advances ageUpdatedAt by the number of years added', () => {
    const base = '2025-01-01T00:00:00.000Z';
    const d = new Date(new Date(base).getTime() + 365 * 24 * 60 * 60 * 1000);
    const result = autoIncrementAge({ age: 30, ageUpdatedAt: base, now: d });

    // The new base should be exactly 365 days after the old base
    const expectedBase = new Date(
      new Date(base).getTime() + 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(result.ageUpdatedAt).toBe(expectedBase);
  });
});
