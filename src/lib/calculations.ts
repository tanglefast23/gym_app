// ---------------------------------------------------------------------------
// calculations.ts -- Pure utility functions for the Workout PWA.
// All weight is stored internally as integer grams.
// ---------------------------------------------------------------------------

// ---- Unit conversions -----------------------------------------------------

/** Convert grams to kilograms. */
export function gramsToKg(grams: number): number {
  return grams / 1000;
}

/** Convert grams to pounds. */
export function gramsToLb(grams: number): number {
  return grams / 453.592;
}

/** Convert kilograms to grams (rounded to the nearest integer). */
export function kgToGrams(kg: number): number {
  return Math.round(kg * 1000);
}

/** Convert pounds to grams (rounded to the nearest integer). */
export function lbToGrams(lb: number): number {
  return Math.round(lb * 453.592);
}

/**
 * Format weight for display based on unit system.
 *
 * Examples:
 * - `formatWeight(80000, 'kg')` => `"80 kg"`
 * - `formatWeight(80500, 'kg')` => `"80.5 kg"`
 * - `formatWeight(45359, 'lb')` => `"100 lbs"`
 */
export function formatWeight(grams: number, unit: 'kg' | 'lb'): string {
  if (unit === 'kg') {
    const kg = gramsToKg(grams);
    return kg % 1 === 0 ? `${kg} kg` : `${kg.toFixed(1)} kg`;
  }
  const lb = gramsToLb(grams);
  return lb % 1 === 0 ? `${lb} lbs` : `${lb.toFixed(1)} lbs`;
}

/** Format weight number only (no unit suffix). */
export function formatWeightValue(grams: number, unit: 'kg' | 'lb'): string {
  const value = unit === 'kg' ? gramsToKg(grams) : gramsToLb(grams);
  return value % 1 === 0 ? `${value}` : value.toFixed(1);
}

/** Convert a user-facing display value back to grams. */
export function displayToGrams(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? kgToGrams(value) : lbToGrams(value);
}

/** Get the step size in grams for a given display step and unit. */
export function stepToGrams(step: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? kgToGrams(step) : lbToGrams(step);
}

// ---- Weight rounding -------------------------------------------------------

/**
 * Round a weight in grams to the nearest plate-friendly increment.
 *
 * `stepG` is the smallest plate increment in grams (e.g. 2500 for 2.5 kg).
 * Returns integer grams.
 */
export function roundToNearestStep(grams: number, stepG: number): number {
  if (stepG <= 0) return Math.round(grams);
  return Math.round(grams / stepG) * stepG;
}

// ---- 1RM Calculation ------------------------------------------------------

/**
 * Calculate estimated 1RM using the Epley formula.
 *
 * Only valid for sets with 12 or fewer reps.
 * Returns `null` if `reps > 12`, `reps <= 0`, or `weightG <= 0`.
 * When `reps === 1` the weight itself is the 1RM.
 *
 * The result is in the same unit as the input (grams).
 */
export function calculateEpley1RM(
  weightG: number,
  reps: number,
): number | null {
  if (reps > 12 || reps <= 0 || weightG <= 0) return null;
  if (reps === 1) return weightG;
  return Math.round(weightG * (1 + reps / 30));
}

// ---- Volume ---------------------------------------------------------------

/** Calculate volume for a single set (`weightG * reps`). */
export function setVolume(weightG: number, reps: number): number {
  return weightG * reps;
}

/** Calculate total volume from an array of completed sets. */
export function totalVolume(
  sets: ReadonlyArray<{ weightG: number; repsDone: number }>,
): number {
  return sets.reduce(
    (total, set) => total + setVolume(set.weightG, set.repsDone),
    0,
  );
}

// ---- Rep formatting -------------------------------------------------------

/**
 * Format a rep target as a string.
 *
 * Returns `"10"` when `min === max`, otherwise `"8-12"`.
 */
export function formatRepTarget(min: number, max: number): string {
  return min === max ? `${min}` : `${min}-${max}`;
}

// ---- Time formatting ------------------------------------------------------

/**
 * Format seconds to `MM:SS` display.
 *
 * Negative values are clamped to `0:00`.
 */
export function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format a duration in seconds to a human-readable string.
 *
 * Examples:
 * - `formatDuration(4980)` => `"1h 23m"`
 * - `formatDuration(300)`  => `"5m"`
 */
export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
