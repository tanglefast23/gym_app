import { describe, it, expect } from 'vitest';
import {
  WORKOUT_COLORS,
  colorForIndex,
  buildColorMap,
  hexToRgba,
} from '@/lib/workoutTypeColors';

// ---------------------------------------------------------------------------
// colorForIndex
// ---------------------------------------------------------------------------

describe('colorForIndex', () => {
  it('returns the first color for index 0', () => {
    expect(colorForIndex(0)).toBe(WORKOUT_COLORS[0]);
  });

  it('returns the second color for index 1', () => {
    expect(colorForIndex(1)).toBe(WORKOUT_COLORS[1]);
  });

  it('cycles when index exceeds palette length', () => {
    const len = WORKOUT_COLORS.length;
    expect(colorForIndex(len)).toBe(WORKOUT_COLORS[0]);
    expect(colorForIndex(len + 1)).toBe(WORKOUT_COLORS[1]);
  });

  it('handles large indices', () => {
    const len = WORKOUT_COLORS.length;
    expect(colorForIndex(1000)).toBe(WORKOUT_COLORS[1000 % len]);
  });
});

// ---------------------------------------------------------------------------
// buildColorMap
// ---------------------------------------------------------------------------

describe('buildColorMap', () => {
  it('assigns sequential colors to unique names', () => {
    const map = buildColorMap(['Push', 'Pull', 'Legs']);
    expect(map.get('Push')).toBe(WORKOUT_COLORS[0]);
    expect(map.get('Pull')).toBe(WORKOUT_COLORS[1]);
    expect(map.get('Legs')).toBe(WORKOUT_COLORS[2]);
  });

  it('deduplicates names (first occurrence wins)', () => {
    const map = buildColorMap(['Push', 'Pull', 'Push', 'Legs']);
    expect(map.size).toBe(3);
    // Push keeps its original color (index 0), Legs gets index 2 (not 3)
    expect(map.get('Push')).toBe(WORKOUT_COLORS[0]);
    expect(map.get('Pull')).toBe(WORKOUT_COLORS[1]);
    expect(map.get('Legs')).toBe(WORKOUT_COLORS[2]);
  });

  it('returns an empty map for empty input', () => {
    expect(buildColorMap([]).size).toBe(0);
  });

  it('handles a single name', () => {
    const map = buildColorMap(['Solo']);
    expect(map.size).toBe(1);
    expect(map.get('Solo')).toBe(WORKOUT_COLORS[0]);
  });
});

// ---------------------------------------------------------------------------
// hexToRgba
// ---------------------------------------------------------------------------

describe('hexToRgba', () => {
  it('converts #A8E6CF to correct rgba', () => {
    // A8=168, E6=230, CF=207
    expect(hexToRgba('#A8E6CF', 0.5)).toBe('rgba(168, 230, 207, 0.5)');
  });

  it('handles hex without # prefix', () => {
    expect(hexToRgba('A8E6CF', 1)).toBe('rgba(168, 230, 207, 1)');
  });

  it('handles black (#000000)', () => {
    expect(hexToRgba('#000000', 0.8)).toBe('rgba(0, 0, 0, 0.8)');
  });

  it('handles white (#FFFFFF)', () => {
    expect(hexToRgba('#FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
  });

  it('returns fallback for invalid hex', () => {
    expect(hexToRgba('nope', 0.5)).toBe('rgba(0,0,0,0.5)');
  });

  it('returns fallback for short hex (#FFF)', () => {
    // The regex expects exactly 6 hex digits
    expect(hexToRgba('#FFF', 0.5)).toBe('rgba(0,0,0,0.5)');
  });

  it('handles alpha of 0', () => {
    expect(hexToRgba('#FF0000', 0)).toBe('rgba(255, 0, 0, 0)');
  });
});
