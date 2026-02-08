import { VALIDATION } from '@/types/workout';
import type { TemplateBlock } from '@/types/workout';

/**
 * Sanitize a text input: trim, collapse whitespace, strip control chars.
 * @param input - Raw user input string
 * @returns Cleaned string safe for storage
 */
export function sanitizeText(input: string): string {
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '') // strip control characters
    .replace(/\s+/g, ' ');            // collapse whitespace
}

/**
 * Validate workout name: non-empty, within max length.
 * @param name - Raw workout name
 * @returns Error message string, or null if valid
 */
export function validateWorkoutName(name: string): string | null {
  const clean = sanitizeText(name);
  if (clean.length === 0) return 'Workout name is required';
  if (clean.length > VALIDATION.WORKOUT_NAME_MAX) return `Name must be ${VALIDATION.WORKOUT_NAME_MAX} chars or less`;
  return null;
}

/**
 * Validate exercise name: non-empty, within max length.
 * @param name - Raw exercise name
 * @returns Error message string, or null if valid
 */
export function validateExerciseName(name: string): string | null {
  const clean = sanitizeText(name);
  if (clean.length === 0) return 'Exercise name is required';
  if (clean.length > VALIDATION.EXERCISE_NAME_MAX) return `Name must be ${VALIDATION.EXERCISE_NAME_MAX} chars or less`;
  return null;
}

/**
 * Validate notes field length.
 * @param notes - Raw notes string
 * @returns Error message string, or null if valid
 */
export function validateNotes(notes: string): string | null {
  if (notes.length > VALIDATION.NOTES_MAX) return `Notes must be ${VALIDATION.NOTES_MAX} chars or less`;
  return null;
}

/**
 * Validate sets count: must be a positive integer within bounds.
 * @param sets - Number of sets
 * @returns Error message string, or null if valid
 */
export function validateSets(sets: number): string | null {
  if (!Number.isInteger(sets) || sets < 1) return 'Sets must be at least 1';
  if (sets > VALIDATION.MAX_SETS) return `Maximum ${VALIDATION.MAX_SETS} sets`;
  return null;
}

/**
 * Validate rep range: min <= max, both positive integers, within bounds.
 * @param min - Minimum reps target
 * @param max - Maximum reps target
 * @returns Error message string, or null if valid
 */
export function validateRepRange(min: number, max: number): string | null {
  if (!Number.isInteger(min) || !Number.isInteger(max)) return 'Reps must be whole numbers';
  if (min < 1) return 'Minimum reps must be at least 1';
  // max === 0 is the AMRAP sentinel — always valid
  if (max === 0) return null;
  if (max > VALIDATION.MAX_REPS) return `Maximum ${VALIDATION.MAX_REPS} reps`;
  if (min > max) return 'Min reps cannot exceed max reps';
  return null;
}

/**
 * Validate rest time in seconds: integer within allowed range.
 * @param seconds - Rest duration in seconds
 * @returns Error message string, or null if valid
 */
export function validateRestTime(seconds: number): string | null {
  if (!Number.isInteger(seconds)) return 'Rest time must be a whole number';
  if (seconds < VALIDATION.MIN_REST_SEC) return `Minimum ${VALIDATION.MIN_REST_SEC} seconds`;
  if (seconds > VALIDATION.MAX_REST_SEC) return `Maximum ${VALIDATION.MAX_REST_SEC} seconds`;
  return null;
}

/**
 * Validate weight stored as integer grams: non-negative, within max.
 * @param weightG - Weight in grams
 * @returns Error message string, or null if valid
 */
export function validateWeightG(weightG: number): string | null {
  if (!Number.isInteger(weightG)) return 'Weight must be stored as integer grams';
  if (weightG < 0) return 'Weight cannot be negative';
  if (weightG > VALIDATION.MAX_WEIGHT_G) return 'Weight exceeds maximum';
  return null;
}

/**
 * Validate a single template block (exercise or superset).
 * Returns an array of error messages; empty array means valid.
 * @param block - The template block to validate
 * @returns Array of error message strings
 */
export function validateBlock(
  block: TemplateBlock,
  nameMap?: Record<string, string>,
): string[] {
  const errors: string[] = [];

  const setsErr = validateSets(block.sets);
  if (setsErr) errors.push(setsErr);

  if (block.type === 'exercise') {
    const repErr = validateRepRange(block.repsMin, block.repsMax);
    if (repErr) errors.push(repErr);
    const hasExercise = block.exerciseId || (nameMap && nameMap[block.id]?.trim());
    if (!hasExercise) errors.push('Exercise is required');
    if (block.restBetweenSetsSec !== null) {
      const restErr = validateRestTime(block.restBetweenSetsSec);
      if (restErr) errors.push(restErr);
    }
  } else if (block.type === 'superset') {
    if (block.exercises.length < 2) errors.push('Superset must have at least 2 exercises');
    for (let i = 0; i < block.exercises.length; i++) {
      const ex = block.exercises[i];
      const nameKey = `${block.id}:${i}`;
      const hasExercise = ex.exerciseId || (nameMap && nameMap[nameKey]?.trim());
      if (!hasExercise) errors.push('All superset exercises require a name');
      const repErr = validateRepRange(ex.repsMin, ex.repsMax);
      if (repErr) errors.push(`Superset exercise: ${repErr}`);
    }
    const restBetween = validateRestTime(block.restBetweenExercisesSec);
    if (restBetween) errors.push(`Rest between exercises: ${restBetween}`);
    const restAfter = validateRestTime(block.restBetweenSupersetsSec);
    if (restAfter) errors.push(`Rest between supersets: ${restAfter}`);
  }

  return errors;
}

/**
 * Validate a full workout template: name + all blocks.
 * Returns an array of error messages; empty array means valid.
 * @param name - Workout template name
 * @param blocks - Array of template blocks
 * @returns Array of error message strings
 */
export function validateTemplate(
  name: string,
  blocks: TemplateBlock[],
  nameMap?: Record<string, string>,
): string[] {
  const errors: string[] = [];

  const nameErr = validateWorkoutName(name);
  if (nameErr) errors.push(nameErr);

  if (blocks.length === 0) {
    errors.push('At least one exercise block is required');
  }

  for (let i = 0; i < blocks.length; i++) {
    const blockErrors = validateBlock(blocks[i], nameMap);
    for (const err of blockErrors) {
      errors.push(`Block ${i + 1}: ${err}`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Per-record import validation helpers
// ---------------------------------------------------------------------------

/** Check whether a string is a valid ISO 8601 date that JS can parse. */
function isValidISODate(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const ts = Date.parse(value);
  return !Number.isNaN(ts);
}

/**
 * Validate a single exercise record from an import payload.
 * @param record - Unknown record to validate
 * @param index - Position in the array (used in error messages)
 * @returns Array of error strings; empty means valid
 */
export function validateImportExercise(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `exercises[${index}]`;

  if (typeof record !== 'object' || record === null) {
    return [`${prefix}: must be an object`];
  }
  const r = record as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.length === 0) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (typeof r.name !== 'string' || r.name.length === 0 || r.name.length > VALIDATION.EXERCISE_NAME_MAX) {
    errors.push(`${prefix}: "name" must be a string between 1 and ${VALIDATION.EXERCISE_NAME_MAX} characters`);
  }
  return errors;
}

/**
 * Validate a single template record from an import payload.
 * Checks top-level fields only (id, name, blocks array existence).
 * @param record - Unknown record to validate
 * @param index - Position in the array (used in error messages)
 * @returns Array of error strings; empty means valid
 */
export function validateImportTemplate(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `templates[${index}]`;

  if (typeof record !== 'object' || record === null) {
    return [`${prefix}: must be an object`];
  }
  const r = record as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.length === 0) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (typeof r.name !== 'string' || r.name.length === 0 || r.name.length > VALIDATION.WORKOUT_NAME_MAX) {
    errors.push(`${prefix}: "name" must be a string between 1 and ${VALIDATION.WORKOUT_NAME_MAX} characters`);
  }
  if (!Array.isArray(r.blocks)) {
    errors.push(`${prefix}: "blocks" must be an array`);
  }
  return errors;
}

/**
 * Validate a single workout log record from an import payload.
 * @param record - Unknown record to validate
 * @param index - Position in the array (used in error messages)
 * @returns Array of error strings; empty means valid
 */
export function validateImportLog(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `logs[${index}]`;

  if (typeof record !== 'object' || record === null) {
    return [`${prefix}: must be an object`];
  }
  const r = record as Record<string, unknown>;

  if (typeof r.id !== 'string' || r.id.length === 0) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (!isValidISODate(r.startedAt)) {
    errors.push(`${prefix}: "startedAt" must be a valid ISO date string`);
  }
  if (r.status !== 'completed' && r.status !== 'partial') {
    errors.push(`${prefix}: "status" must be "completed" or "partial"`);
  }
  return errors;
}

/**
 * Validate settings from an import payload.
 * Checks the key fields that drive app behaviour.
 * @param settings - Unknown settings value to validate
 * @returns Array of error strings; empty means valid
 */
export function validateImportSettings(settings: unknown): string[] {
  const errors: string[] = [];
  const prefix = 'settings';

  if (typeof settings !== 'object' || settings === null) {
    return [`${prefix}: must be an object`];
  }
  const s = settings as Record<string, unknown>;

  if (s.unitSystem !== 'kg' && s.unitSystem !== 'lb') {
    errors.push(`${prefix}: "unitSystem" must be "kg" or "lb"`);
  }
  if (
    typeof s.defaultRestBetweenSetsSec !== 'number' ||
    s.defaultRestBetweenSetsSec <= 0
  ) {
    errors.push(`${prefix}: "defaultRestBetweenSetsSec" must be a positive number`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Top-level import validation
// ---------------------------------------------------------------------------

/**
 * Validate import data schema (structure + per-record checks).
 * Ensures the unknown data matches the expected ExportData shape
 * before further processing.
 * @param data - Unknown parsed JSON data to validate
 * @returns Object with `valid` boolean and `errors` array
 */
export function validateImportData(data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Invalid data format'] };
  }

  const d = data as Record<string, unknown>;

  if (typeof d.schemaVersion !== 'number' || d.schemaVersion !== 1) {
    errors.push('Unsupported schema version');
  }
  if (typeof d.exportedAt !== 'string') {
    errors.push('Missing export timestamp');
  }
  if (!Array.isArray(d.exercises)) {
    errors.push('Missing exercises array');
  }
  if (!Array.isArray(d.templates)) {
    errors.push('Missing templates array');
  }
  if (!Array.isArray(d.logs)) {
    errors.push('Missing logs array');
  }
  if (!Array.isArray(d.exerciseHistory)) {
    errors.push('Missing exercise history array');
  }
  if (!Array.isArray(d.achievements)) {
    errors.push('Missing achievements array');
  }

  // If top-level structure is broken, bail out before per-record checks
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Per-record validation
  const exercises = d.exercises as unknown[];
  for (let i = 0; i < exercises.length; i++) {
    errors.push(...validateImportExercise(exercises[i], i));
  }

  const templates = d.templates as unknown[];
  for (let i = 0; i < templates.length; i++) {
    errors.push(...validateImportTemplate(templates[i], i));
  }

  const logs = d.logs as unknown[];
  for (let i = 0; i < logs.length; i++) {
    errors.push(...validateImportLog(logs[i], i));
  }

  // Settings is optional in the schema but if present must be valid
  if (d.settings !== undefined && d.settings !== null) {
    errors.push(...validateImportSettings(d.settings));
  }

  return { valid: errors.length === 0, errors };
}
