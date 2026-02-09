import { db } from '@/lib/db';
import { validateImportData } from '@/lib/validation';
import { useSettingsStore } from '@/stores/settingsStore';
import { DEFAULT_SETTINGS } from '@/types/workout';
import { VALIDATION } from '@/types/workout';
import type { ExportData, UserSettings } from '@/types/workout';

/** Maximum allowed import file size in bytes (10 MB). */
const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024;

function getSettingsSnapshot(): UserSettings {
  const s = useSettingsStore.getState();
  return {
    id: 'settings',
    unitSystem: s.unitSystem,
    defaultRestBetweenSetsSec: s.defaultRestBetweenSetsSec,
    defaultTransitionsSec: s.defaultTransitionsSec,
    weightStepsKg: s.weightStepsKg,
    weightStepsLb: s.weightStepsLb,
    hapticFeedback: s.hapticFeedback,
    soundEnabled: s.soundEnabled,
    restTimerSound: s.restTimerSound,
    autoStartRestTimer: s.autoStartRestTimer,
    theme: s.theme,
    heightCm: s.heightCm,
    age: s.age,
    sex: s.sex,
  };
}

function normalizeImportedSettings(raw: unknown): UserSettings {
  const next: UserSettings = { ...DEFAULT_SETTINGS };

  if (typeof raw !== 'object' || raw === null) {
    return next;
  }

  const r = raw as Record<string, unknown>;

  if (r.unitSystem === 'kg' || r.unitSystem === 'lb') {
    next.unitSystem = r.unitSystem;
  }

  if (typeof r.defaultRestBetweenSetsSec === 'number') {
    next.defaultRestBetweenSetsSec = Math.max(
      VALIDATION.MIN_REST_SEC,
      Math.min(VALIDATION.MAX_REST_SEC, r.defaultRestBetweenSetsSec),
    );
  }

  if (typeof r.defaultTransitionsSec === 'number') {
    next.defaultTransitionsSec = Math.max(
      VALIDATION.MIN_REST_SEC,
      Math.min(VALIDATION.MAX_REST_SEC, r.defaultTransitionsSec),
    );
  }

  if (
    Array.isArray(r.weightStepsKg) &&
    r.weightStepsKg.length > 0 &&
    r.weightStepsKg.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
  ) {
    next.weightStepsKg = r.weightStepsKg;
  }

  if (
    Array.isArray(r.weightStepsLb) &&
    r.weightStepsLb.length > 0 &&
    r.weightStepsLb.every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)
  ) {
    next.weightStepsLb = r.weightStepsLb;
  }

  if (typeof r.hapticFeedback === 'boolean') {
    next.hapticFeedback = r.hapticFeedback;
  }

  if (typeof r.soundEnabled === 'boolean') {
    next.soundEnabled = r.soundEnabled;
  }

  if (typeof r.restTimerSound === 'boolean') {
    next.restTimerSound = r.restTimerSound;
  }

  if (typeof r.autoStartRestTimer === 'boolean') {
    next.autoStartRestTimer = r.autoStartRestTimer;
  }

  if (r.theme === 'dark' || r.theme === 'light' || r.theme === 'system') {
    next.theme = r.theme;
  }

  return next;
}

/**
 * Export all app data as a JSON object.
 * Reads every Dexie table in parallel and packages the result
 * into the `ExportData` envelope with schema version and timestamp.
 * The caller decides how to persist/download the returned object.
 * @returns A fully-populated `ExportData` object
 */
export async function exportAllData(): Promise<ExportData> {
  const [exercises, templates, logs, exerciseHistory, achievements] =
    await Promise.all([
      db.exercises.toArray(),
      db.templates.toArray(),
      db.logs.toArray(),
      db.exerciseHistory.toArray(),
      db.achievements.toArray(),
    ]);

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    settings: getSettingsSnapshot(),
    exercises,
    templates,
    logs,
    exerciseHistory,
    achievements,
  };
}

/**
 * Download all app data as a timestamped JSON file via the browser
 * download mechanism. Creates a temporary anchor element, triggers
 * the download, then cleans up the object URL.
 */
export async function downloadExport(): Promise<void> {
  const data = await exportAllData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `workout-pwa-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import data from a JSON file, replacing ALL existing data (v1 replace-all strategy).
 * Validates the file contents via `validateImportData` before touching the database.
 * The entire operation runs inside a single Dexie read-write transaction so a
 * failure at any point rolls back cleanly.
 * @param file - A `File` object (e.g. from an `<input type="file">`)
 * @returns `{ success: true, errors: [] }` on success, or
 *          `{ success: false, errors: string[] }` describing what went wrong
 */
export async function importData(
  file: File,
): Promise<{ success: boolean; errors: string[] }> {
  try {
    // Reject oversized files before parsing to avoid freezing the browser
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        success: false,
        errors: [`File is too large (${sizeMB} MB). Maximum allowed size is 10 MB.`],
      };
    }

    const text = await file.text();
    const data: unknown = JSON.parse(text);

    // Validate structure before touching DB
    const validation = validateImportData(data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const parsed = data as ExportData;
    const normalizedSettings = normalizeImportedSettings(
      (parsed as unknown as { settings?: unknown }).settings,
    );

    // Clear all tables and replace inside a single transaction
    await db.transaction(
      'rw',
      [
        db.exercises,
        db.templates,
        db.logs,
        db.exerciseHistory,
        db.achievements,
        db.settings,
        db.crashRecovery,
      ],
      async () => {
        // Clear everything
        await Promise.all([
          db.exercises.clear(),
          db.templates.clear(),
          db.logs.clear(),
          db.exerciseHistory.clear(),
          db.achievements.clear(),
          db.settings.clear(),
          db.crashRecovery.clear(),
        ]);

        // Import new data (skip empty arrays to avoid unnecessary calls)
        if (parsed.exercises.length > 0) {
          await db.exercises.bulkAdd(parsed.exercises);
        }
        if (parsed.templates.length > 0) {
          await db.templates.bulkAdd(parsed.templates);
        }
        if (parsed.logs.length > 0) {
          await db.logs.bulkAdd(parsed.logs);
        }
        if (parsed.exerciseHistory.length > 0) {
          await db.exerciseHistory.bulkAdd(parsed.exerciseHistory);
        }
        if (parsed.achievements.length > 0) {
          await db.achievements.bulkAdd(parsed.achievements);
        }
        await db.settings.put(normalizedSettings);
      },
    );

    // Sync the Zustand settings store so in-memory state matches the imported data
    useSettingsStore.getState().rehydrateFromImport(normalizedSettings);

    return { success: true, errors: [] };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Unknown import error';
    return { success: false, errors: [message] };
  }
}

/**
 * Read and parse a JSON backup file without modifying the database,
 * returning a human-readable summary of what would be imported.
 * Useful for showing a confirmation dialog before the destructive
 * replace-all import.
 * @param file - A `File` object to preview
 * @returns An object with `valid`, `errors`, and an optional `summary`
 *          containing counts and the original export timestamp
 */
export async function previewImport(file: File): Promise<{
  valid: boolean;
  errors: string[];
  summary?: {
    exercises: number;
    templates: number;
    logs: number;
    achievements: number;
    exportedAt: string;
  };
}> {
  try {
    // Reject oversized files before parsing to avoid freezing the browser
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        errors: [`File is too large (${sizeMB} MB). Maximum allowed size is 10 MB.`],
      };
    }

    const text = await file.text();
    const data: unknown = JSON.parse(text);

    const validation = validateImportData(data);
    if (!validation.valid) {
      return { valid: false, errors: validation.errors };
    }

    const d = data as ExportData;
    return {
      valid: true,
      errors: [],
      summary: {
        exercises: d.exercises.length,
        templates: d.templates.length,
        logs: d.logs.length,
        achievements: d.achievements.length,
        exportedAt: d.exportedAt,
      },
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : 'Failed to read file';
    return { valid: false, errors: [message] };
  }
}
