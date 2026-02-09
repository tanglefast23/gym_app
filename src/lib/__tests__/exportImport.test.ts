import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExportData, UserSettings, ExerciseBlock } from '@/types/workout';
import { DEFAULT_SETTINGS } from '@/types/workout';

// ---------------------------------------------------------------------------
// Mock the Dexie database (vi.hoisted to avoid TDZ with vi.mock factory)
// ---------------------------------------------------------------------------

const {
  mockExercises,
  mockTemplates,
  mockLogs,
  mockLogSnapshots,
  mockExerciseHistory,
  mockAchievements,
  mockBodyWeights,
  mockSettings,
  mockCrashRecovery,
  mockTransaction,
  mockRehydrateFromImport,
} = vi.hoisted(() => ({
  mockExercises: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockTemplates: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockLogs: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockLogSnapshots: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockExerciseHistory: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockAchievements: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockBodyWeights: {
    toArray: vi.fn(),
    clear: vi.fn(),
    bulkAdd: vi.fn(),
  },
  mockSettings: {
    clear: vi.fn(),
    put: vi.fn(),
  },
  mockCrashRecovery: {
    clear: vi.fn(),
  },
  mockTransaction: vi.fn(),
  mockRehydrateFromImport: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    exercises: mockExercises,
    templates: mockTemplates,
    logs: mockLogs,
    logSnapshots: mockLogSnapshots,
    exerciseHistory: mockExerciseHistory,
    achievements: mockAchievements,
    bodyWeights: mockBodyWeights,
    settings: mockSettings,
    crashRecovery: mockCrashRecovery,
    transaction: mockTransaction,
  },
}));

vi.mock('@/stores/settingsStore', () => ({
  useSettingsStore: {
    getState: vi.fn(() => ({
      unitSystem: 'kg' as const,
      defaultRestBetweenSetsSec: 60,
      defaultTransitionsSec: 60,
      weightStepsKg: [1, 2.5, 5],
      weightStepsLb: [2.5, 5, 10],
      hapticFeedback: true,
      soundEnabled: true,
      restTimerSound: true,
      autoStartRestTimer: true,
      theme: 'dark' as const,
      heightCm: null,
      age: null,
      sex: null,
      rehydrateFromImport: mockRehydrateFromImport,
    })),
  },
}));

import {
  exportAllData,
  previewImport,
  importData,
  exportBackupBeforeImport,
} from '../exportImport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeValidExportData(overrides: Partial<ExportData> = {}): ExportData {
  return {
    schemaVersion: 1,
    exportedAt: '2025-06-01T00:00:00Z',
    settings: { ...DEFAULT_SETTINGS },
    exercises: [],
    templates: [],
    logs: [],
    exerciseHistory: [],
    achievements: [],
    bodyWeights: [],
    ...overrides,
  };
}

/**
 * Create a File-like object with a working `.text()` method.
 * jsdom's File does not implement `.text()`, so we polyfill it.
 */
function makeFile(data: unknown, name = 'backup.json'): File {
  const json = JSON.stringify(data);
  const file = new File([json], name, { type: 'application/json' });
  file.text = () => Promise.resolve(json);
  return file;
}

function makeLargeFile(sizeBytes: number): File {
  const content = 'x'.repeat(sizeBytes);
  const file = new File([content], 'large.json', { type: 'application/json' });
  file.text = () => Promise.resolve(content);
  return file;
}

beforeEach(() => {
  vi.clearAllMocks();

  // Default mock implementations for DB tables
  mockExercises.toArray.mockResolvedValue([]);
  mockTemplates.toArray.mockResolvedValue([]);
  mockLogs.toArray.mockResolvedValue([]);
  mockLogSnapshots.toArray.mockResolvedValue([]);
  mockExerciseHistory.toArray.mockResolvedValue([]);
  mockAchievements.toArray.mockResolvedValue([]);
  mockBodyWeights.toArray.mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// exportAllData
// ---------------------------------------------------------------------------

describe('exportAllData', () => {
  it('returns correct JSON structure with all tables', async () => {
    const exercises = [{ id: 'ex-1', name: 'Bench Press', visualKey: 'bench', createdAt: '2025-01-01', updatedAt: '2025-01-01' }];
    const templates = [{ id: 't-1', name: 'Push Day', blocks: [], defaultRestBetweenSetsSec: null, createdAt: '2025-01-01', updatedAt: '2025-01-01', isArchived: false }];

    mockExercises.toArray.mockResolvedValue(exercises);
    mockTemplates.toArray.mockResolvedValue(templates);
    mockLogs.toArray.mockResolvedValue([]);
    mockExerciseHistory.toArray.mockResolvedValue([]);
    mockAchievements.toArray.mockResolvedValue([]);
    mockBodyWeights.toArray.mockResolvedValue([]);

    const result = await exportAllData();

    expect(result.exercises).toEqual(exercises);
    expect(result.templates).toEqual(templates);
    expect(result.logs).toEqual([]);
    expect(result.exerciseHistory).toEqual([]);
    expect(result.achievements).toEqual([]);
    expect(result.bodyWeights).toEqual([]);
  });

  it('includes schemaVersion of 1', async () => {
    const result = await exportAllData();
    expect(result.schemaVersion).toBe(1);
  });

  it('includes exportedAt as a valid ISO timestamp', async () => {
    const result = await exportAllData();
    expect(result.exportedAt).toBeDefined();
    const parsed = new Date(result.exportedAt);
    expect(parsed.getTime()).not.toBeNaN();
  });

  it('includes settings snapshot from the Zustand store', async () => {
    const result = await exportAllData();
    expect(result.settings).toBeDefined();
    expect(result.settings.id).toBe('settings');
    expect(result.settings.unitSystem).toBe('kg');
    expect(result.settings.defaultRestBetweenSetsSec).toBe(60);
  });

  it('reads all tables in parallel', async () => {
    await exportAllData();

    expect(mockExercises.toArray).toHaveBeenCalledOnce();
    expect(mockTemplates.toArray).toHaveBeenCalledOnce();
    expect(mockLogs.toArray).toHaveBeenCalledOnce();
    expect(mockLogSnapshots.toArray).toHaveBeenCalledOnce();
    expect(mockExerciseHistory.toArray).toHaveBeenCalledOnce();
    expect(mockAchievements.toArray).toHaveBeenCalledOnce();
    expect(mockBodyWeights.toArray).toHaveBeenCalledOnce();
  });

  it('re-joins snapshots onto logs for backward compatibility', async () => {
    const snapshot: ExerciseBlock[] = [{ id: 'b-1', type: 'exercise', exerciseId: 'ex-bench', sets: 3, repsMin: 8, repsMax: 12, restBetweenSetsSec: null, transitionRestSec: null }];
    mockLogs.toArray.mockResolvedValue([{ id: 'log-1', templateName: 'Push', performedSets: [], startedAt: '2025-01-01', endedAt: null, durationSec: 0, totalVolumeG: 0, status: 'completed', templateId: 't-1' }]);
    mockLogSnapshots.toArray.mockResolvedValue([{ logId: 'log-1', templateSnapshot: snapshot }]);

    const result = await exportAllData();

    expect(result.logs[0].templateSnapshot).toEqual(snapshot);
  });
});

// ---------------------------------------------------------------------------
// previewImport
// ---------------------------------------------------------------------------

describe('previewImport', () => {
  it('validates and returns summary for a correct file', async () => {
    const data = makeValidExportData({
      exercises: [{ id: 'ex-1', name: 'Bench Press', visualKey: 'bench', createdAt: '2025-01-01', updatedAt: '2025-01-01' }],
      templates: [
        { id: 't-1', name: 'Push Day', blocks: [], defaultRestBetweenSetsSec: null, createdAt: '2025-01-01', updatedAt: '2025-01-01', isArchived: false },
        { id: 't-2', name: 'Pull Day', blocks: [], defaultRestBetweenSetsSec: null, createdAt: '2025-01-01', updatedAt: '2025-01-01', isArchived: false },
      ],
      logs: [],
      achievements: [],
    });

    const file = makeFile(data);
    const result = await previewImport(file);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.summary).toBeDefined();
    expect(result.summary!.exercises).toBe(1);
    expect(result.summary!.templates).toBe(2);
    expect(result.summary!.logs).toBe(0);
    expect(result.summary!.achievements).toBe(0);
    expect(result.summary!.exportedAt).toBe('2025-06-01T00:00:00Z');
  });

  it('rejects invalid JSON structure', async () => {
    const file = makeFile({ invalid: true });
    const result = await previewImport(file);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a file larger than 10 MB', async () => {
    const file = makeLargeFile(11 * 1024 * 1024);
    const result = await previewImport(file);

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('too large');
  });

  it('handles unparseable JSON gracefully', async () => {
    const file = new File(['not-json{{{'], 'bad.json', { type: 'application/json' });
    const result = await previewImport(file);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('includes body weight count in summary', async () => {
    const data = makeValidExportData({
      bodyWeights: [
        { id: 'bw-1', recordedAt: '2025-06-01T08:00:00Z', weightG: 80000 },
        { id: 'bw-2', recordedAt: '2025-06-02T08:00:00Z', weightG: 79500 },
      ],
    });

    const file = makeFile(data);
    const result = await previewImport(file);

    expect(result.valid).toBe(true);
    expect(result.summary!.bodyWeights).toBe(2);
  });

});

// ---------------------------------------------------------------------------
// importData
// ---------------------------------------------------------------------------

describe('importData', () => {
  beforeEach(() => {
    // Default transaction mock: execute callback immediately
    mockTransaction.mockImplementation(async (_mode: string, _tables: unknown[], cb: () => Promise<void>) => {
      await cb();
    });

    // Default clear/bulkAdd mocks
    mockExercises.clear.mockResolvedValue(undefined);
    mockTemplates.clear.mockResolvedValue(undefined);
    mockLogs.clear.mockResolvedValue(undefined);
    mockLogSnapshots.clear.mockResolvedValue(undefined);
    mockExerciseHistory.clear.mockResolvedValue(undefined);
    mockAchievements.clear.mockResolvedValue(undefined);
    mockBodyWeights.clear.mockResolvedValue(undefined);
    mockSettings.clear.mockResolvedValue(undefined);
    mockCrashRecovery.clear.mockResolvedValue(undefined);

    mockExercises.bulkAdd.mockResolvedValue(undefined);
    mockTemplates.bulkAdd.mockResolvedValue(undefined);
    mockLogs.bulkAdd.mockResolvedValue(undefined);
    mockLogSnapshots.bulkAdd.mockResolvedValue(undefined);
    mockExerciseHistory.bulkAdd.mockResolvedValue(undefined);
    mockAchievements.bulkAdd.mockResolvedValue(undefined);
    mockBodyWeights.bulkAdd.mockResolvedValue(undefined);
    mockSettings.put.mockResolvedValue(undefined);
  });

  it('clears existing data and imports new data', async () => {
    const exercises = [{ id: 'ex-1', name: 'Bench Press', visualKey: 'bench', createdAt: '2025-01-01', updatedAt: '2025-01-01' }];
    const data = makeValidExportData({ exercises });
    const file = makeFile(data);

    const result = await importData(file);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);

    // All tables should be cleared
    expect(mockExercises.clear).toHaveBeenCalledOnce();
    expect(mockTemplates.clear).toHaveBeenCalledOnce();
    expect(mockLogs.clear).toHaveBeenCalledOnce();
    expect(mockLogSnapshots.clear).toHaveBeenCalledOnce();
    expect(mockExerciseHistory.clear).toHaveBeenCalledOnce();
    expect(mockAchievements.clear).toHaveBeenCalledOnce();
    expect(mockBodyWeights.clear).toHaveBeenCalledOnce();
    expect(mockSettings.clear).toHaveBeenCalledOnce();
    expect(mockCrashRecovery.clear).toHaveBeenCalledOnce();

    // Non-empty arrays should be bulk-added
    expect(mockExercises.bulkAdd).toHaveBeenCalledWith(exercises);
  });

  it('skips bulkAdd for empty arrays', async () => {
    const data = makeValidExportData(); // all arrays are empty
    const file = makeFile(data);

    await importData(file);

    expect(mockExercises.bulkAdd).not.toHaveBeenCalled();
    expect(mockTemplates.bulkAdd).not.toHaveBeenCalled();
    expect(mockLogs.bulkAdd).not.toHaveBeenCalled();
    expect(mockExerciseHistory.bulkAdd).not.toHaveBeenCalled();
    expect(mockAchievements.bulkAdd).not.toHaveBeenCalled();
    expect(mockBodyWeights.bulkAdd).not.toHaveBeenCalled();
  });

  it('writes normalized settings via settings.put', async () => {
    const customSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      unitSystem: 'lb',
      defaultRestBetweenSetsSec: 90,
    };
    const data = makeValidExportData({ settings: customSettings });
    const file = makeFile(data);

    await importData(file);

    expect(mockSettings.put).toHaveBeenCalledOnce();
    const putArg = mockSettings.put.mock.calls[0][0] as UserSettings;
    expect(putArg.unitSystem).toBe('lb');
    expect(putArg.defaultRestBetweenSetsSec).toBe(90);
  });

  it('rehydrates the Zustand settings store after import', async () => {
    const data = makeValidExportData();
    const file = makeFile(data);

    await importData(file);

    expect(mockRehydrateFromImport).toHaveBeenCalledOnce();
  });

  it('rejects a file larger than 10 MB', async () => {
    const file = makeLargeFile(11 * 1024 * 1024);

    const result = await importData(file);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain('too large');
  });

  it('rejects invalid data structure', async () => {
    const file = makeFile({ invalid: true });

    const result = await importData(file);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('wraps import in a single Dexie transaction', async () => {
    const data = makeValidExportData();
    const file = makeFile(data);

    await importData(file);

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockTransaction.mock.calls[0][0]).toBe('rw');
  });

  it('returns error on unparseable JSON', async () => {
    const file = new File(['not-json{{{'], 'bad.json', { type: 'application/json' });

    const result = await importData(file);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('imports body weights when present', async () => {
    const bodyWeights = [
      { id: 'bw-1', recordedAt: '2025-06-01T08:00:00Z', weightG: 80000 },
    ];
    const data = makeValidExportData({ bodyWeights });
    const file = makeFile(data);

    await importData(file);

    expect(mockBodyWeights.bulkAdd).toHaveBeenCalledWith(bodyWeights);
  });


  it('splits templateSnapshot from logs into logSnapshots on import', async () => {
    const snapshot = [{ id: 'b-1', type: 'exercise', exerciseId: 'ex-bench', sets: 3, repsMin: 8, repsMax: 12, restBetweenSetsSec: null, transitionRestSec: null }];
    const data = makeValidExportData({
      logs: [{
        id: 'l-1',
        startedAt: '2025-01-01T10:00:00Z',
        status: 'completed',
        templateId: 't-1',
        templateName: 'Push Day',
        templateSnapshot: snapshot,
        performedSets: [],
        endedAt: '2025-01-01T11:00:00Z',
        durationSec: 3600,
        totalVolumeG: 0,
      }],
    });
    const file = makeFile(data);

    await importData(file);

    // Logs should be added WITHOUT templateSnapshot
    expect(mockLogs.bulkAdd).toHaveBeenCalledOnce();
    const addedLogs = mockLogs.bulkAdd.mock.calls[0][0];
    expect(addedLogs[0]).not.toHaveProperty('templateSnapshot');

    // Snapshots should be added to the logSnapshots table
    expect(mockLogSnapshots.bulkAdd).toHaveBeenCalledOnce();
    const addedSnapshots = mockLogSnapshots.bulkAdd.mock.calls[0][0];
    expect(addedSnapshots[0].logId).toBe('l-1');
    expect(addedSnapshots[0].templateSnapshot).toEqual(snapshot);
  });

  it('handles import with missing settings gracefully', async () => {
    // ExportData without settings at top level -- the normalizer should apply defaults
    const rawData = {
      schemaVersion: 1,
      exportedAt: '2025-06-01T00:00:00Z',
      exercises: [],
      templates: [],
      logs: [],
      exerciseHistory: [],
      achievements: [],
    };
    const file = makeFile(rawData);

    const result = await importData(file);

    expect(result.success).toBe(true);
    // Settings should still be put with defaults
    expect(mockSettings.put).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// exportBackupBeforeImport
// ---------------------------------------------------------------------------

describe('exportBackupBeforeImport', () => {
  it('creates a download and returns true', async () => {
    // Mock DOM APIs for the download mechanism
    const mockClick = vi.fn();
    const mockCreateObjectURL = vi.fn().mockReturnValue('blob:test');
    const mockRevokeObjectURL = vi.fn();

    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    });

    const mockElement = {
      href: '',
      download: '',
      click: mockClick,
    };
    vi.spyOn(document, 'createElement').mockReturnValue(mockElement as unknown as HTMLElement);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockElement as unknown as HTMLElement);
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockElement as unknown as HTMLElement);

    const result = await exportBackupBeforeImport();

    expect(result).toBe(true);
    expect(mockClick).toHaveBeenCalledOnce();
    expect(mockCreateObjectURL).toHaveBeenCalledOnce();
    expect(mockRevokeObjectURL).toHaveBeenCalledOnce();
    expect(mockElement.download).toContain('workout-pwa-backup-before-import');

    vi.restoreAllMocks();
  });

  it('returns false when an error occurs', async () => {
    // Make exportAllData fail by making a table throw
    mockExercises.toArray.mockRejectedValue(new Error('DB failure'));

    const result = await exportBackupBeforeImport();

    expect(result).toBe(false);
  });
});
