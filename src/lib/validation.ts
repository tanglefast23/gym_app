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
    if ((block as { transitionRestSec?: number | null }).transitionRestSec != null) {
      const restErr = validateRestTime(
        (block as { transitionRestSec: number }).transitionRestSec,
      );
      if (restErr) errors.push(`Transition rest: ${restErr}`);
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
    if ((block as { transitionRestSec?: number | null }).transitionRestSec != null) {
      const restErr = validateRestTime(
        (block as { transitionRestSec: number }).transitionRestSec,
      );
      if (restErr) errors.push(`Transition rest: ${restErr}`);
    }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInt(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function validateImportPerformedSet(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `logs[*].performedSets[${index}]`;

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (!isNonEmptyString(record.exerciseId)) {
    errors.push(`${prefix}: "exerciseId" must be a non-empty string`);
  }
  if (!isNonEmptyString(record.exerciseNameSnapshot)) {
    errors.push(`${prefix}: "exerciseNameSnapshot" must be a non-empty string`);
  }
  if (!isNonEmptyString(record.blockPath)) {
    errors.push(`${prefix}: "blockPath" must be a non-empty string`);
  }
  if (!isInt(record.setIndex) || record.setIndex < 0) {
    errors.push(`${prefix}: "setIndex" must be an integer >= 0`);
  }

  if (!isInt(record.repsTargetMin) || record.repsTargetMin < 0) {
    errors.push(`${prefix}: "repsTargetMin" must be an integer >= 0`);
  }
  if (!isInt(record.repsTargetMax) || record.repsTargetMax < 0) {
    errors.push(`${prefix}: "repsTargetMax" must be an integer >= 0`);
  }
  if (!isInt(record.repsDone) || record.repsDone < 0 || record.repsDone > VALIDATION.MAX_REPS) {
    errors.push(`${prefix}: "repsDone" must be an integer between 0 and ${VALIDATION.MAX_REPS}`);
  }

  if (!isInt(record.weightG) || record.weightG < 0 || record.weightG > VALIDATION.MAX_WEIGHT_G) {
    errors.push(`${prefix}: "weightG" must be an integer between 0 and ${VALIDATION.MAX_WEIGHT_G}`);
  }

  return errors;
}

function validateImportTemplateBlocks(blocks: unknown, blocksPath: string): string[] {
  const errors: string[] = [];

  if (!Array.isArray(blocks)) {
    return [`${blocksPath}: must be an array`];
  }

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockPrefix = `${blocksPath}[${i}]`;

    if (!isRecord(block)) {
      errors.push(`${blockPrefix}: must be an object`);
      continue;
    }

    if (!isNonEmptyString(block.id)) {
      errors.push(`${blockPrefix}: "id" must be a non-empty string`);
    }

    if (block.type === 'exercise') {
      if (!isNonEmptyString(block.exerciseId)) {
        errors.push(`${blockPrefix}: "exerciseId" must be a non-empty string`);
      }
      if (!isInt(block.sets)) {
        errors.push(`${blockPrefix}: "sets" must be an integer`);
      } else {
        const err = validateSets(block.sets);
        if (err) errors.push(`${blockPrefix}: ${err}`);
      }

      if (!isInt(block.repsMin) || !isInt(block.repsMax)) {
        errors.push(`${blockPrefix}: "repsMin" and "repsMax" must be integers`);
      } else {
        const err = validateRepRange(block.repsMin, block.repsMax);
        if (err) errors.push(`${blockPrefix}: ${err}`);
      }

      if (block.restBetweenSetsSec !== null) {
        if (!isInt(block.restBetweenSetsSec)) {
          errors.push(`${blockPrefix}: "restBetweenSetsSec" must be an integer or null`);
        } else {
          const err = validateRestTime(block.restBetweenSetsSec);
          if (err) errors.push(`${blockPrefix}: ${err}`);
        }
      }

      if (block.transitionRestSec !== null && block.transitionRestSec !== undefined) {
        if (!isInt(block.transitionRestSec)) {
          errors.push(`${blockPrefix}: "transitionRestSec" must be an integer or null`);
        } else {
          const err = validateRestTime(block.transitionRestSec);
          if (err) errors.push(`${blockPrefix}: ${err}`);
        }
      }
    } else if (block.type === 'superset') {
      if (!isInt(block.sets)) {
        errors.push(`${blockPrefix}: "sets" must be an integer`);
      } else {
        const err = validateSets(block.sets);
        if (err) errors.push(`${blockPrefix}: ${err}`);
      }

      if (!Array.isArray(block.exercises) || block.exercises.length < 2) {
        errors.push(`${blockPrefix}: "exercises" must be an array with at least 2 items`);
      } else {
        for (let j = 0; j < block.exercises.length; j++) {
          const ex = block.exercises[j];
          const exPrefix = `${blockPrefix}.exercises[${j}]`;
          if (!isRecord(ex)) {
            errors.push(`${exPrefix}: must be an object`);
            continue;
          }
          if (!isNonEmptyString(ex.exerciseId)) {
            errors.push(`${exPrefix}: "exerciseId" must be a non-empty string`);
          }
          if (!isInt(ex.repsMin) || !isInt(ex.repsMax)) {
            errors.push(`${exPrefix}: "repsMin" and "repsMax" must be integers`);
          } else {
            const err = validateRepRange(ex.repsMin, ex.repsMax);
            if (err) errors.push(`${exPrefix}: ${err}`);
          }
        }
      }

      if (!isInt(block.restBetweenExercisesSec)) {
        errors.push(`${blockPrefix}: "restBetweenExercisesSec" must be an integer`);
      } else {
        const err = validateRestTime(block.restBetweenExercisesSec);
        if (err) errors.push(`${blockPrefix}: ${err}`);
      }

      if (!isInt(block.restBetweenSupersetsSec)) {
        errors.push(`${blockPrefix}: "restBetweenSupersetsSec" must be an integer`);
      } else {
        const err = validateRestTime(block.restBetweenSupersetsSec);
        if (err) errors.push(`${blockPrefix}: ${err}`);
      }

      if (block.transitionRestSec !== null && block.transitionRestSec !== undefined) {
        if (!isInt(block.transitionRestSec)) {
          errors.push(`${blockPrefix}: "transitionRestSec" must be an integer or null`);
        } else {
          const err = validateRestTime(block.transitionRestSec);
          if (err) errors.push(`${blockPrefix}: ${err}`);
        }
      }
    } else {
      errors.push(`${blockPrefix}: "type" must be "exercise" or "superset"`);
    }
  }

  return errors;
}

export function validateImportExerciseHistoryEntry(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `exerciseHistory[${index}]`;

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (record.id !== undefined && record.id !== null && !isInt(record.id)) {
    errors.push(`${prefix}: "id" must be a number if provided`);
  }
  if (!isNonEmptyString(record.logId)) {
    errors.push(`${prefix}: "logId" must be a non-empty string`);
  }
  if (!isNonEmptyString(record.exerciseId)) {
    errors.push(`${prefix}: "exerciseId" must be a non-empty string`);
  }
  if (!isNonEmptyString(record.exerciseName)) {
    errors.push(`${prefix}: "exerciseName" must be a non-empty string`);
  }
  if (!isValidISODate(record.performedAt)) {
    errors.push(`${prefix}: "performedAt" must be a valid ISO date string`);
  }

  if (!isInt(record.bestWeightG) || record.bestWeightG < 0) {
    errors.push(`${prefix}: "bestWeightG" must be an integer >= 0`);
  }
  if (!isInt(record.totalVolumeG) || record.totalVolumeG < 0) {
    errors.push(`${prefix}: "totalVolumeG" must be an integer >= 0`);
  }
  if (!isInt(record.totalSets) || record.totalSets < 0) {
    errors.push(`${prefix}: "totalSets" must be an integer >= 0`);
  }
  if (!isInt(record.totalReps) || record.totalReps < 0) {
    errors.push(`${prefix}: "totalReps" must be an integer >= 0`);
  }

  if (record.estimated1RM_G !== null && record.estimated1RM_G !== undefined && !isFiniteNumber(record.estimated1RM_G)) {
    errors.push(`${prefix}: "estimated1RM_G" must be a number or null`);
  }

  return errors;
}

export function validateImportUnlockedAchievement(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `achievements[${index}]`;

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (!isNonEmptyString(record.achievementId)) {
    errors.push(`${prefix}: "achievementId" must be a non-empty string`);
  }
  if (!isValidISODate(record.unlockedAt)) {
    errors.push(`${prefix}: "unlockedAt" must be a valid ISO date string`);
  }
  if (record.context !== null && record.context !== undefined && typeof record.context !== 'string') {
    errors.push(`${prefix}: "context" must be a string or null`);
  }

  return errors;
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

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (!isNonEmptyString(record.id)) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (
    typeof record.name !== 'string' ||
    record.name.length === 0 ||
    record.name.length > VALIDATION.EXERCISE_NAME_MAX
  ) {
    errors.push(`${prefix}: "name" must be a string between 1 and ${VALIDATION.EXERCISE_NAME_MAX} characters`);
  }
  if (!isNonEmptyString(record.visualKey)) {
    errors.push(`${prefix}: "visualKey" must be a non-empty string`);
  }
  if (!isValidISODate(record.createdAt)) {
    errors.push(`${prefix}: "createdAt" must be a valid ISO date string`);
  }
  if (!isValidISODate(record.updatedAt)) {
    errors.push(`${prefix}: "updatedAt" must be a valid ISO date string`);
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

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (!isNonEmptyString(record.id)) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (
    typeof record.name !== 'string' ||
    record.name.length === 0 ||
    record.name.length > VALIDATION.WORKOUT_NAME_MAX
  ) {
    errors.push(`${prefix}: "name" must be a string between 1 and ${VALIDATION.WORKOUT_NAME_MAX} characters`);
  }

  errors.push(...validateImportTemplateBlocks(record.blocks, `${prefix}.blocks`));

  if (record.defaultRestBetweenSetsSec !== null && record.defaultRestBetweenSetsSec !== undefined) {
    if (!isInt(record.defaultRestBetweenSetsSec) || record.defaultRestBetweenSetsSec < 0) {
      errors.push(`${prefix}: "defaultRestBetweenSetsSec" must be an integer >= 0 or null`);
    }
  }
  if (!isValidISODate(record.createdAt)) {
    errors.push(`${prefix}: "createdAt" must be a valid ISO date string`);
  }
  if (!isValidISODate(record.updatedAt)) {
    errors.push(`${prefix}: "updatedAt" must be a valid ISO date string`);
  }
  if (typeof record.isArchived !== 'boolean') {
    errors.push(`${prefix}: "isArchived" must be a boolean`);
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

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (!isNonEmptyString(record.id)) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (!isValidISODate(record.startedAt)) {
    errors.push(`${prefix}: "startedAt" must be a valid ISO date string`);
  }
  if (record.status !== 'completed' && record.status !== 'partial') {
    errors.push(`${prefix}: "status" must be "completed" or "partial"`);
  }

  if (record.templateId !== null && record.templateId !== undefined && typeof record.templateId !== 'string') {
    errors.push(`${prefix}: "templateId" must be a string or null`);
  }
  if (!isNonEmptyString(record.templateName)) {
    errors.push(`${prefix}: "templateName" must be a non-empty string`);
  }

  errors.push(...validateImportTemplateBlocks(record.templateSnapshot, `${prefix}.templateSnapshot`));

  if (!Array.isArray(record.performedSets)) {
    errors.push(`${prefix}: "performedSets" must be an array`);
  } else {
    for (let i = 0; i < record.performedSets.length; i++) {
      errors.push(...validateImportPerformedSet(record.performedSets[i], i));
    }
  }

  if (record.endedAt !== null && record.endedAt !== undefined && !isValidISODate(record.endedAt)) {
    errors.push(`${prefix}: "endedAt" must be a valid ISO date string or null`);
  }
  if (!isInt(record.durationSec) || record.durationSec < 0) {
    errors.push(`${prefix}: "durationSec" must be an integer >= 0`);
  }
  if (!isInt(record.totalVolumeG) || record.totalVolumeG < 0) {
    errors.push(`${prefix}: "totalVolumeG" must be an integer >= 0`);
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

  if (!isRecord(settings)) {
    return [`${prefix}: must be an object`];
  }

  if (settings.id !== undefined && settings.id !== 'settings') {
    errors.push(`${prefix}: "id" must be "settings"`);
  }

  if (settings.unitSystem !== undefined && settings.unitSystem !== 'kg' && settings.unitSystem !== 'lb') {
    errors.push(`${prefix}: "unitSystem" must be "kg" or "lb"`);
  }

  if (settings.defaultRestBetweenSetsSec !== undefined) {
    if (!isInt(settings.defaultRestBetweenSetsSec) || settings.defaultRestBetweenSetsSec < VALIDATION.MIN_REST_SEC) {
      errors.push(`${prefix}: "defaultRestBetweenSetsSec" must be an integer >= ${VALIDATION.MIN_REST_SEC}`);
    }
  }

  if (settings.defaultTransitionsSec !== undefined) {
    if (!isInt(settings.defaultTransitionsSec) || settings.defaultTransitionsSec < VALIDATION.MIN_REST_SEC) {
      errors.push(`${prefix}: "defaultTransitionsSec" must be an integer >= ${VALIDATION.MIN_REST_SEC}`);
    }
  }

  if (settings.weightStepsKg !== undefined) {
    if (
      !Array.isArray(settings.weightStepsKg) ||
      settings.weightStepsKg.length === 0 ||
      !settings.weightStepsKg.every((v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0)
    ) {
      errors.push(`${prefix}: "weightStepsKg" must be a non-empty array of positive numbers`);
    }
  }

  if (settings.weightStepsLb !== undefined) {
    if (
      !Array.isArray(settings.weightStepsLb) ||
      settings.weightStepsLb.length === 0 ||
      !settings.weightStepsLb.every((v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0)
    ) {
      errors.push(`${prefix}: "weightStepsLb" must be a non-empty array of positive numbers`);
    }
  }

  if (settings.hapticFeedback !== undefined && typeof settings.hapticFeedback !== 'boolean') {
    errors.push(`${prefix}: "hapticFeedback" must be a boolean`);
  }
  if (settings.soundEnabled !== undefined && typeof settings.soundEnabled !== 'boolean') {
    errors.push(`${prefix}: "soundEnabled" must be a boolean`);
  }
  if (settings.restTimerSound !== undefined && typeof settings.restTimerSound !== 'boolean') {
    errors.push(`${prefix}: "restTimerSound" must be a boolean`);
  }
  if (settings.autoStartRestTimer !== undefined && typeof settings.autoStartRestTimer !== 'boolean') {
    errors.push(`${prefix}: "autoStartRestTimer" must be a boolean`);
  }
  if (settings.theme !== undefined && settings.theme !== 'dark' && settings.theme !== 'light' && settings.theme !== 'system') {
    errors.push(`${prefix}: "theme" must be "dark", "light", or "system"`);
  }

  if (settings.heightCm !== undefined && settings.heightCm !== null) {
    if (typeof settings.heightCm !== 'number' || !Number.isFinite(settings.heightCm) || settings.heightCm <= 0) {
      errors.push(`${prefix}: "heightCm" must be a positive number or null`);
    }
  }

  if (settings.age !== undefined && settings.age !== null) {
    if (!isInt(settings.age) || settings.age < 0 || settings.age > 130) {
      errors.push(`${prefix}: "age" must be an integer between 0 and 130 or null`);
    }
  }

  if (settings.sex !== undefined && settings.sex !== null && settings.sex !== 'male' && settings.sex !== 'female') {
    errors.push(`${prefix}: "sex" must be "male", "female", or null`);
  }

  if (settings.ageUpdatedAt !== undefined && settings.ageUpdatedAt !== null) {
    if (typeof settings.ageUpdatedAt !== 'string' || !isValidISODate(settings.ageUpdatedAt)) {
      errors.push(`${prefix}: "ageUpdatedAt" must be a valid ISO date string or null`);
    }
  }

  return errors;
}

export function validateImportBodyWeightEntry(record: unknown, index: number): string[] {
  const errors: string[] = [];
  const prefix = `bodyWeights[${index}]`;

  if (!isRecord(record)) {
    return [`${prefix}: must be an object`];
  }

  if (!isNonEmptyString(record.id)) {
    errors.push(`${prefix}: "id" must be a non-empty string`);
  }
  if (!isValidISODate(record.recordedAt)) {
    errors.push(`${prefix}: "recordedAt" must be a valid ISO date string`);
  }
  if (!isInt(record.weightG) || record.weightG < 0 || record.weightG > VALIDATION.MAX_WEIGHT_G) {
    errors.push(`${prefix}: "weightG" must be an integer between 0 and ${VALIDATION.MAX_WEIGHT_G}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Property stripping helpers — keep only known fields, discard extras
// ---------------------------------------------------------------------------

/**
 * Strip unknown properties from a validated exercise record.
 * Only retains fields defined in the Exercise interface.
 */
export function stripExercise(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    name: record.name,
    visualKey: record.visualKey,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Strip unknown properties from a validated performed set record.
 * Only retains fields defined in the PerformedSet interface.
 */
function stripPerformedSet(record: Record<string, unknown>): Record<string, unknown> {
  return {
    exerciseId: record.exerciseId,
    exerciseNameSnapshot: record.exerciseNameSnapshot,
    blockPath: record.blockPath,
    setIndex: record.setIndex,
    repsTargetMin: record.repsTargetMin,
    repsTargetMax: record.repsTargetMax,
    repsDone: record.repsDone,
    weightG: record.weightG,
  };
}

/**
 * Strip unknown properties from a validated ExerciseBlockExercise.
 */
function stripExerciseBlockExercise(record: Record<string, unknown>): Record<string, unknown> {
  return {
    exerciseId: record.exerciseId,
    repsMin: record.repsMin,
    repsMax: record.repsMax,
  };
}

/**
 * Strip unknown properties from a validated template block.
 * Handles both 'exercise' and 'superset' block types.
 */
function stripTemplateBlock(record: Record<string, unknown>): Record<string, unknown> {
  if (record.type === 'exercise') {
    return {
      id: record.id,
      type: record.type,
      exerciseId: record.exerciseId,
      sets: record.sets,
      repsMin: record.repsMin,
      repsMax: record.repsMax,
      restBetweenSetsSec: record.restBetweenSetsSec ?? null,
      transitionRestSec: record.transitionRestSec ?? null,
    };
  }

  // superset
  const exercises = Array.isArray(record.exercises)
    ? (record.exercises as Record<string, unknown>[]).map(stripExerciseBlockExercise)
    : record.exercises;

  return {
    id: record.id,
    type: record.type,
    sets: record.sets,
    exercises,
    restBetweenExercisesSec: record.restBetweenExercisesSec,
    restBetweenSupersetsSec: record.restBetweenSupersetsSec,
    transitionRestSec: record.transitionRestSec ?? null,
  };
}

/**
 * Strip unknown properties from a validated template blocks array.
 */
function stripTemplateBlocks(blocks: unknown): unknown[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b: Record<string, unknown>) => stripTemplateBlock(b));
}

/**
 * Strip unknown properties from a validated template record.
 * Only retains fields defined in the WorkoutTemplate interface.
 */
export function stripTemplate(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    name: record.name,
    blocks: stripTemplateBlocks(record.blocks),
    defaultRestBetweenSetsSec: record.defaultRestBetweenSetsSec ?? null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    isArchived: record.isArchived,
  };
}

/**
 * Strip unknown properties from a validated workout log record.
 * Only retains fields defined in the WorkoutLog interface.
 */
export function stripLog(record: Record<string, unknown>): Record<string, unknown> {
  const performedSets = Array.isArray(record.performedSets)
    ? (record.performedSets as Record<string, unknown>[]).map(stripPerformedSet)
    : record.performedSets;

  return {
    id: record.id,
    status: record.status,
    templateId: record.templateId ?? null,
    templateName: record.templateName,
    templateSnapshot: stripTemplateBlocks(record.templateSnapshot),
    performedSets,
    startedAt: record.startedAt,
    endedAt: record.endedAt ?? null,
    durationSec: record.durationSec,
    totalVolumeG: record.totalVolumeG,
  };
}

/**
 * Strip unknown properties from a validated exercise history entry.
 * Only retains fields defined in the ExerciseHistoryEntry interface.
 */
export function stripExerciseHistoryEntry(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {
    logId: record.logId,
    exerciseId: record.exerciseId,
    exerciseName: record.exerciseName,
    performedAt: record.performedAt,
    bestWeightG: record.bestWeightG,
    totalVolumeG: record.totalVolumeG,
    totalSets: record.totalSets,
    totalReps: record.totalReps,
    estimated1RM_G: record.estimated1RM_G ?? null,
  };
  // id is optional (auto-increment)
  if (record.id !== undefined && record.id !== null) {
    result.id = record.id;
  }
  return result;
}

/**
 * Strip unknown properties from a validated achievement record.
 * Only retains fields defined in the UnlockedAchievement interface.
 */
export function stripAchievement(record: Record<string, unknown>): Record<string, unknown> {
  return {
    achievementId: record.achievementId,
    unlockedAt: record.unlockedAt,
    context: record.context ?? null,
  };
}

/**
 * Strip unknown properties from a validated body weight entry.
 * Only retains fields defined in the BodyWeightEntry interface.
 */
export function stripBodyWeightEntry(record: Record<string, unknown>): Record<string, unknown> {
  return {
    id: record.id,
    recordedAt: record.recordedAt,
    weightG: record.weightG,
  };
}

/**
 * Strip unknown properties from validated settings.
 * Only retains fields defined in the UserSettings interface.
 */
export function stripSettings(record: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const knownKeys = [
    'id', 'unitSystem', 'defaultRestBetweenSetsSec', 'defaultTransitionsSec',
    'weightStepsKg', 'weightStepsLb', 'hapticFeedback', 'soundEnabled',
    'restTimerSound', 'autoStartRestTimer', 'theme', 'heightCm', 'age', 'ageUpdatedAt', 'sex',
  ];
  for (const key of knownKeys) {
    if (record[key] !== undefined) {
      result[key] = record[key];
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Import array length caps
// ---------------------------------------------------------------------------

const IMPORT_CAPS = {
  exercises: 1_000,
  templates: 500,
  logs: 10_000,
  exerciseHistory: 50_000,
  achievements: 100,
  bodyWeights: 5_000,
  weightStepsKg: 20,
  weightStepsLb: 20,
} as const;

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
  } else if (!isValidISODate(d.exportedAt)) {
    errors.push('Invalid export timestamp');
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

  // --- Array length caps (reject oversized payloads before iterating) ---
  const exercises = d.exercises as unknown[];
  const templates = d.templates as unknown[];
  const logs = d.logs as unknown[];
  const historyEntries = d.exerciseHistory as unknown[];
  const achievements = d.achievements as unknown[];

  if (exercises.length > IMPORT_CAPS.exercises) {
    errors.push(`Too many exercises (max ${IMPORT_CAPS.exercises.toLocaleString()})`);
  }
  if (templates.length > IMPORT_CAPS.templates) {
    errors.push(`Too many templates (max ${IMPORT_CAPS.templates.toLocaleString()})`);
  }
  if (logs.length > IMPORT_CAPS.logs) {
    errors.push(`Too many logs (max ${IMPORT_CAPS.logs.toLocaleString()})`);
  }
  if (historyEntries.length > IMPORT_CAPS.exerciseHistory) {
    errors.push(`Too many exercise history entries (max ${IMPORT_CAPS.exerciseHistory.toLocaleString()})`);
  }
  if (achievements.length > IMPORT_CAPS.achievements) {
    errors.push(`Too many achievements (max ${IMPORT_CAPS.achievements.toLocaleString()})`);
  }

  if (d.bodyWeights !== undefined && Array.isArray(d.bodyWeights)) {
    if ((d.bodyWeights as unknown[]).length > IMPORT_CAPS.bodyWeights) {
      errors.push(`Too many body weight entries (max ${IMPORT_CAPS.bodyWeights.toLocaleString()})`);
    }
  }

  // Check weight steps caps inside settings if present
  if (d.settings !== undefined && d.settings !== null && isRecord(d.settings)) {
    if (Array.isArray(d.settings.weightStepsKg) && d.settings.weightStepsKg.length > IMPORT_CAPS.weightStepsKg) {
      errors.push(`Too many weightStepsKg entries (max ${IMPORT_CAPS.weightStepsKg})`);
    }
    if (Array.isArray(d.settings.weightStepsLb) && d.settings.weightStepsLb.length > IMPORT_CAPS.weightStepsLb) {
      errors.push(`Too many weightStepsLb entries (max ${IMPORT_CAPS.weightStepsLb})`);
    }
  }

  // If any cap was exceeded, return early to avoid iterating over huge arrays
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Per-record validation
  for (let i = 0; i < exercises.length; i++) {
    errors.push(...validateImportExercise(exercises[i], i));
  }

  for (let i = 0; i < templates.length; i++) {
    errors.push(...validateImportTemplate(templates[i], i));
  }

  for (let i = 0; i < logs.length; i++) {
    errors.push(...validateImportLog(logs[i], i));
  }

  for (let i = 0; i < historyEntries.length; i++) {
    errors.push(...validateImportExerciseHistoryEntry(historyEntries[i], i));
  }

  for (let i = 0; i < achievements.length; i++) {
    errors.push(...validateImportUnlockedAchievement(achievements[i], i));
  }

  // Optional for backwards compatibility with older exports
  if (d.bodyWeights !== undefined) {
    if (!Array.isArray(d.bodyWeights)) {
      errors.push('bodyWeights must be an array');
    } else {
      const bodyWeights = d.bodyWeights as unknown[];
      for (let i = 0; i < bodyWeights.length; i++) {
        errors.push(...validateImportBodyWeightEntry(bodyWeights[i], i));
      }
    }
  }

  // Settings is optional in the schema but if present must be valid
  if (d.settings !== undefined && d.settings !== null) {
    errors.push(...validateImportSettings(d.settings));
  }

  // --- Strip unknown properties from all validated records ---
  if (errors.length === 0) {
    for (let i = 0; i < exercises.length; i++) {
      exercises[i] = stripExercise(exercises[i] as Record<string, unknown>);
    }
    for (let i = 0; i < templates.length; i++) {
      templates[i] = stripTemplate(templates[i] as Record<string, unknown>);
    }
    for (let i = 0; i < logs.length; i++) {
      logs[i] = stripLog(logs[i] as Record<string, unknown>);
    }
    for (let i = 0; i < historyEntries.length; i++) {
      historyEntries[i] = stripExerciseHistoryEntry(historyEntries[i] as Record<string, unknown>);
    }
    for (let i = 0; i < achievements.length; i++) {
      achievements[i] = stripAchievement(achievements[i] as Record<string, unknown>);
    }
    if (Array.isArray(d.bodyWeights)) {
      const bodyWeights = d.bodyWeights as unknown[];
      for (let i = 0; i < bodyWeights.length; i++) {
        bodyWeights[i] = stripBodyWeightEntry(bodyWeights[i] as Record<string, unknown>);
      }
    }
    if (d.settings !== undefined && d.settings !== null) {
      d.settings = stripSettings(d.settings as Record<string, unknown>);
    }
  }

  return { valid: errors.length === 0, errors };
}
