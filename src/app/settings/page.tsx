'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Upload, RotateCcw, Trash2, CalendarRange } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button, ConfirmDialog, useToastStore, ToastContainer } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { downloadExport, importData, previewImport } from '@/lib/exportImport';
import {
  getDataCounts,
  deleteAllData,
  previewDeleteByDateRange,
  deleteDataByDateRange,
} from '@/lib/queries';
import type { UnitSystem } from '@/types/workout';
import { VALIDATION } from '@/types/workout';

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

interface SettingRowProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

/** A single row with label on the left and control on the right. */
function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="mr-4 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {description ? (
          <p className="text-xs text-text-muted">{description}</p>
        ) : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

interface ToggleProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

/** Accessible toggle switch. */
function Toggle({ enabled, onToggle, disabled = false }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={disabled ? undefined : onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
        enabled ? 'bg-accent' : 'bg-border'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

interface SegmentedControlProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

/** A row of buttons where the active one is highlighted. */
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-lg bg-surface p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
            value === opt.value
              ? 'bg-accent text-white'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Bold section title with top spacing. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-1 mt-6 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted first:mt-0">
      {children}
    </h2>
  );
}

// ---------------------------------------------------------------------------
// Import preview summary shape
// ---------------------------------------------------------------------------

interface ImportSummary {
  exercises: number;
  templates: number;
  logs: number;
  achievements: number;
  exportedAt: string;
}

// ---------------------------------------------------------------------------
// Unit system options
// ---------------------------------------------------------------------------

const unitOptions: { value: UnitSystem; label: string }[] = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
];

function localDateStartISO(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function localDateEndISO(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Settings store selectors (Zustand v5 pattern -- never call without selector)
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const defaultRest = useSettingsStore((s) => s.defaultRestBetweenSetsSec);
  const weightStepsKg = useSettingsStore((s) => s.weightStepsKg);
  const weightStepsLb = useSettingsStore((s) => s.weightStepsLb);
  const hapticFeedback = useSettingsStore((s) => s.hapticFeedback);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const restTimerSound = useSettingsStore((s) => s.restTimerSound);
  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
  const setDefaultRest = useSettingsStore((s) => s.setDefaultRest);
  const toggleHaptic = useSettingsStore((s) => s.toggleHapticFeedback);
  const toggleMasterSound = useSettingsStore((s) => s.toggleSoundEnabled);
  const toggleTimerSound = useSettingsStore((s) => s.toggleRestTimerSound);
  const autoStartRestTimer = useSettingsStore((s) => s.autoStartRestTimer);
  const toggleAutoStartRestTimer = useSettingsStore((s) => s.toggleAutoStartRestTimer);
  const resetDefaults = useSettingsStore((s) => s.resetToDefaults);

  // Import flow state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // ---- Handlers ----

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await downloadExport();
      addToast('Data exported successfully', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Export failed';
      addToast(msg, 'error');
    } finally {
      setIsExporting(false);
    }
  }, [addToast]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input so the same file can be selected again if needed
      e.target.value = '';

      setImportFile(file);
      setIsImporting(true);

      try {
        const result = await previewImport(file);
        if (!result.valid || !result.summary) {
          addToast(result.errors[0] ?? 'Invalid backup file', 'error');
          setImportFile(null);
          setImportSummary(null);
        } else {
          setImportSummary(result.summary);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to read file';
        addToast(msg, 'error');
        setImportFile(null);
        setImportSummary(null);
      } finally {
        setIsImporting(false);
      }
    },
    [addToast],
  );

  const handleImportConfirm = useCallback(async () => {
    if (!importFile) return;

    setIsImporting(true);
    setShowImportConfirm(false);

    try {
      const result = await importData(importFile);
      if (result.success) {
        addToast('Data imported successfully', 'success');
      } else {
        addToast(result.errors[0] ?? 'Import failed', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      addToast(msg, 'error');
    } finally {
      setIsImporting(false);
      setImportFile(null);
      setImportSummary(null);
    }
  }, [importFile, addToast]);

  const handleRestChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseInt(e.target.value, 10);
      if (Number.isNaN(raw)) return;

      const clamped = Math.max(
        VALIDATION.MIN_REST_SEC,
        Math.min(VALIDATION.MAX_REST_SEC, raw),
      );
      setDefaultRest(clamped);
    },
    [setDefaultRest],
  );

  const handleResetDefaults = useCallback(() => {
    resetDefaults();
    setShowResetConfirm(false);
    addToast('Settings reset to defaults', 'info');
  }, [resetDefaults, addToast]);

  // ---- Data Management State ----

  // Delete all data — two-step confirmation
  const [showDeleteAllStep1, setShowDeleteAllStep1] = useState(false);
  const [showDeleteAllStep2, setShowDeleteAllStep2] = useState(false);
  const [deleteAllCounts, setDeleteAllCounts] = useState<{
    exercises: number;
    templates: number;
    logs: number;
    exerciseHistory: number;
    achievements: number;
  } | null>(null);
  const [deleteAllCountdown, setDeleteAllCountdown] = useState(3);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Delete by date range
  const [showDateRange, setShowDateRange] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [dateRangePreview, setDateRangePreview] = useState<{
    logs: number;
    exerciseHistory: number;
  } | null>(null);
  const [showDateRangeConfirm, setShowDateRangeConfirm] = useState(false);
  const [isDeletingRange, setIsDeletingRange] = useState(false);

  // ---- Data Management Handlers ----

  const handleDeleteAllStep1 = useCallback(async () => {
    try {
      const counts = await getDataCounts();
      setDeleteAllCounts(counts);
      setShowDeleteAllStep1(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load data counts';
      addToast(msg, 'error');
    }
  }, [addToast]);

  const handleDeleteAllStep1Confirm = useCallback(() => {
    setShowDeleteAllStep1(false);
    setDeleteAllCountdown(3);
    setShowDeleteAllStep2(true);
  }, []);

  // Countdown timer for the final delete button
  useEffect(() => {
    if (!showDeleteAllStep2 || deleteAllCountdown <= 0) return;
    const timer = setTimeout(() => setDeleteAllCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [showDeleteAllStep2, deleteAllCountdown]);

  const handleDeleteAllFinal = useCallback(async () => {
    // Guard: countdown must be complete
    if (deleteAllCountdown > 0) return;

    setIsDeletingAll(true);
    setShowDeleteAllStep2(false);
    try {
      await deleteAllData();
      addToast('All data deleted successfully', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      addToast(msg, 'error');
    } finally {
      setIsDeletingAll(false);
      setDeleteAllCounts(null);
    }
  }, [addToast, deleteAllCountdown]);

  // Date range preview — update when dates change
  useEffect(() => {
    if (!dateFrom || !dateTo) {
      setDateRangePreview(null);
      return;
    }

    if (dateFrom > dateTo) {
      setDateRangePreview(null);
      return;
    }

    const fromISO = localDateStartISO(dateFrom);
    const toISO = localDateEndISO(dateTo);

    let cancelled = false;
    previewDeleteByDateRange(fromISO, toISO).then((preview) => {
      if (!cancelled) setDateRangePreview(preview);
    });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo]);

  const handleDateRangeDelete = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    if (dateFrom > dateTo) {
      addToast('"From" date must be on or before "To" date', 'error');
      return;
    }

    setIsDeletingRange(true);
    setShowDateRangeConfirm(false);

    const fromISO = localDateStartISO(dateFrom);
    const toISO = localDateEndISO(dateTo);

    try {
      const result = await deleteDataByDateRange(fromISO, toISO);
      addToast(
        `Deleted ${result.deletedLogs} workout log${result.deletedLogs !== 1 ? 's' : ''} and ${result.deletedHistory} history entr${result.deletedHistory !== 1 ? 'ies' : 'y'}`,
        'success',
      );
      setShowDateRange(false);
      setDateFrom('');
      setDateTo('');
      setDateRangePreview(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete failed';
      addToast(msg, 'error');
    } finally {
      setIsDeletingRange(false);
    }
  }, [dateFrom, dateTo, addToast]);

  return (
    <div className="min-h-dvh bg-background">
      <Header
        title="Settings"
        centered
        leftAction={
          <button
            type="button"
            onClick={() => router.back()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-accent"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="px-5 pt-4 pb-8">
        {/* ---- Units & Preferences ---- */}
        <SectionTitle>Units &amp; Preferences</SectionTitle>

        <SettingRow label="Unit System">
          <SegmentedControl
            options={unitOptions}
            value={unitSystem}
            onChange={setUnitSystem}
          />
        </SettingRow>

        <SettingRow label="Default Rest" description="Between sets (seconds)">
          <input
            id="default-rest"
            type="number"
            value={defaultRest}
            onChange={handleRestChange}
            min={VALIDATION.MIN_REST_SEC}
            max={VALIDATION.MAX_REST_SEC}
            aria-label="Default rest between sets in seconds"
            className="w-20 rounded-lg border border-border bg-surface px-3 py-1.5 text-right text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </SettingRow>

        <SettingRow label="Weight Steps (kg)">
          <span className="text-sm text-text-secondary">
            {weightStepsKg.join(', ')}
          </span>
        </SettingRow>

        <SettingRow label="Weight Steps (lb)">
          <span className="text-sm text-text-secondary">
            {weightStepsLb.join(', ')}
          </span>
        </SettingRow>

        {/* ---- Feedback ---- */}
        <SectionTitle>Feedback</SectionTitle>

        <SettingRow label="Haptic Feedback" description="Vibration on taps and events">
          <Toggle enabled={hapticFeedback} onToggle={toggleHaptic} />
        </SettingRow>

        <SettingRow label="Sound" description="Master toggle for all sounds">
          <Toggle enabled={soundEnabled} onToggle={toggleMasterSound} />
        </SettingRow>

        <SettingRow label="Timer Sound" description="Countdown beeps and timer alerts">
          <Toggle
            enabled={restTimerSound}
            onToggle={toggleTimerSound}
            disabled={!soundEnabled}
          />
        </SettingRow>

        {/* ---- Workout ---- */}
        <SectionTitle>Workout</SectionTitle>

        <SettingRow label="Auto-Start Rest Timer" description="Start rest countdown automatically after each set">
          <Toggle enabled={autoStartRestTimer} onToggle={toggleAutoStartRestTimer} />
        </SettingRow>

        {/* ---- Data ---- */}
        <SectionTitle>Data</SectionTitle>

        <div className="space-y-3">
          <Button
            fullWidth
            variant="secondary"
            onClick={handleExport}
            loading={isExporting}
          >
            <Download className="h-4 w-4" />
            Export Data
          </Button>

          <Button
            fullWidth
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            loading={isImporting}
          >
            <Upload className="h-4 w-4" />
            Import Data
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            aria-label="Import data file"
            onChange={handleFileSelect}
          />
        </div>

        {/* Import summary preview card */}
        {importSummary ? (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <p className="mb-2 text-sm font-medium text-text-primary">
              Import Preview
            </p>
            <p className="text-xs text-text-secondary">
              {importSummary.exercises} exercises, {importSummary.templates}{' '}
              templates, {importSummary.logs} logs, {importSummary.achievements}{' '}
              achievements
            </p>
            <p className="mt-1 text-xs text-text-muted">
              Exported on{' '}
              {new Date(importSummary.exportedAt).toLocaleDateString()}
            </p>
            <p className="mt-2 text-xs text-warning">
              Warning: This will replace ALL existing data
            </p>
            <Button
              variant="danger"
              size="sm"
              className="mt-3"
              onClick={() => setShowImportConfirm(true)}
            >
              Confirm Import
            </Button>
          </div>
        ) : null}

        {/* ---- Data Management ---- */}
        <SectionTitle>Data Management</SectionTitle>

        <div className="space-y-3">
          <Button
            fullWidth
            variant="danger"
            onClick={handleDeleteAllStep1}
            loading={isDeletingAll}
          >
            <Trash2 className="h-4 w-4" />
            Delete All Data
          </Button>

          <Button
            fullWidth
            variant="secondary"
            onClick={() => setShowDateRange(!showDateRange)}
          >
            <CalendarRange className="h-4 w-4" />
            Delete Data by Date Range
          </Button>
        </div>

        {/* Date range picker card */}
        {showDateRange ? (
          <div className="mt-4 rounded-xl border border-border bg-surface p-4">
            <p className="mb-3 text-sm font-medium text-text-primary">
              Select Date Range
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-text-muted" htmlFor="date-from">
                  From
                </label>
                <input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs text-text-muted" htmlFor="date-to">
                  To
                </label>
                <input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-border bg-elevated px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Live preview of affected data */}
            {dateRangePreview ? (
              <div className="mt-3">
                <p className="text-sm text-text-secondary">
                  This will delete{' '}
                  <span className="font-semibold text-danger">
                    {dateRangePreview.logs} workout log{dateRangePreview.logs !== 1 ? 's' : ''}
                  </span>{' '}
                  and{' '}
                  <span className="font-semibold text-danger">
                    {dateRangePreview.exerciseHistory} history entr{dateRangePreview.exerciseHistory !== 1 ? 'ies' : 'y'}
                  </span>
                </p>
                <p className="mt-1 text-xs text-warning">
                  This action cannot be undone. Affected achievements may no longer be accurate.
                </p>
              </div>
            ) : null}

            {dateFrom && dateTo ? (
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={() => setShowDateRangeConfirm(true)}
                loading={isDeletingRange}
                disabled={!dateRangePreview || (dateRangePreview.logs === 0 && dateRangePreview.exerciseHistory === 0)}
              >
                Delete Selected Data
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* ---- About ---- */}
        <SectionTitle>About</SectionTitle>

        <p className="text-sm text-text-muted">Workout PWA v0.1.0</p>
        <p className="mt-1 text-xs text-text-muted">
          Local-only &middot; No cloud sync &middot; Your data stays on this
          device
        </p>

        {/* ---- Reset ---- */}
        <Button
          fullWidth
          variant="ghost"
          className="mt-8"
          onClick={() => setShowResetConfirm(true)}
        >
          <RotateCcw className="h-4 w-4" />
          Reset Settings to Defaults
        </Button>
      </div>

      {/* Import confirmation dialog */}
      <ConfirmDialog
        isOpen={showImportConfirm}
        onClose={() => setShowImportConfirm(false)}
        onConfirm={handleImportConfirm}
        title="Replace all data?"
        description="This will permanently delete all existing workouts, logs, and history, replacing them with the imported data. This cannot be undone."
        confirmText="Replace All Data"
        variant="danger"
      />

      {/* Reset settings confirmation dialog */}
      <ConfirmDialog
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        onConfirm={handleResetDefaults}
        title="Reset settings?"
        description="This will reset all settings (units, rest timer, etc.) to their defaults. Your workout data will not be affected."
        confirmText="Reset Settings"
        variant="default"
      />

      {/* Delete all data — Step 1: Show what will be deleted */}
      <ConfirmDialog
        isOpen={showDeleteAllStep1}
        onClose={() => setShowDeleteAllStep1(false)}
        onConfirm={handleDeleteAllStep1Confirm}
        title="Delete all data?"
        description={
          deleteAllCounts
            ? `This will permanently delete ALL your data:\n\n• ${deleteAllCounts.logs} workout logs\n• ${deleteAllCounts.templates} workout templates\n• ${deleteAllCounts.exercises} exercises\n• ${deleteAllCounts.exerciseHistory} history entries\n• ${deleteAllCounts.achievements} achievements\n\nYour settings will be preserved. This cannot be undone.`
            : 'Loading data counts...'
        }
        confirmText="Continue"
        variant="danger"
      />

      {/* Delete all data — Step 2: Final confirmation with countdown */}
      <ConfirmDialog
        isOpen={showDeleteAllStep2}
        onClose={() => setShowDeleteAllStep2(false)}
        onConfirm={handleDeleteAllFinal}
        title="Are you absolutely sure?"
        description="All workouts, templates, exercises, history, and achievements will be permanently erased. This is your last chance to cancel."
        confirmText={deleteAllCountdown > 0 ? `Wait ${deleteAllCountdown}s...` : 'Delete Everything'}
        confirmDisabled={deleteAllCountdown > 0}
        variant="danger"
      />

      {/* Delete by date range — confirmation */}
      <ConfirmDialog
        isOpen={showDateRangeConfirm}
        onClose={() => setShowDateRangeConfirm(false)}
        onConfirm={handleDateRangeDelete}
        title="Delete data in this range?"
        description={
          dateRangePreview
            ? `You are about to permanently delete ${dateRangePreview.logs} workout log${dateRangePreview.logs !== 1 ? 's' : ''} and ${dateRangePreview.exerciseHistory} history entr${dateRangePreview.exerciseHistory !== 1 ? 'ies' : 'y'} between ${dateFrom} and ${dateTo}. This cannot be undone.`
            : 'No data to delete in this range.'
        }
        confirmText="Delete Selected Data"
        variant="danger"
      />

      <ToastContainer />
    </div>
  );
}
