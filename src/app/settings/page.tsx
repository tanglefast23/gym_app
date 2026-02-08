'use client';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Download, Upload, RotateCcw } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button, ConfirmDialog, useToastStore, ToastContainer } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { downloadExport, importData, previewImport } from '@/lib/exportImport';
import type { UnitSystem, ThemeMode } from '@/types/workout';
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
}

/** Accessible toggle switch. */
function Toggle({ enabled, onToggle }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={onToggle}
      className={`relative h-6 w-11 rounded-full transition-colors ${
        enabled ? 'bg-accent' : 'bg-border'
      }`}
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
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
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
    <h2 className="mb-1 mt-6 text-xs font-semibold uppercase tracking-wider text-text-muted first:mt-0">
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

const themeOptions: { value: ThemeMode; label: string }[] = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'system', label: 'System' },
];

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
  const restTimerSound = useSettingsStore((s) => s.restTimerSound);
  const theme = useSettingsStore((s) => s.theme);
  const setUnitSystem = useSettingsStore((s) => s.setUnitSystem);
  const setDefaultRest = useSettingsStore((s) => s.setDefaultRest);
  const toggleHaptic = useSettingsStore((s) => s.toggleHapticFeedback);
  const toggleSound = useSettingsStore((s) => s.toggleRestTimerSound);
  const setTheme = useSettingsStore((s) => s.setTheme);
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

  return (
    <div className="min-h-dvh bg-background">
      <Header
        title="Settings"
        leftAction={
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center text-accent"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="px-4 pt-4 pb-8">
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
            type="number"
            value={defaultRest}
            onChange={handleRestChange}
            min={VALIDATION.MIN_REST_SEC}
            max={VALIDATION.MAX_REST_SEC}
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

        <SettingRow label="Haptic Feedback">
          <Toggle enabled={hapticFeedback} onToggle={toggleHaptic} />
        </SettingRow>

        <SettingRow label="Timer Sound">
          <Toggle enabled={restTimerSound} onToggle={toggleSound} />
        </SettingRow>

        {/* ---- Theme ---- */}
        <SectionTitle>Theme</SectionTitle>

        <SettingRow label="Appearance">
          <SegmentedControl
            options={themeOptions}
            value={theme}
            onChange={setTheme}
          />
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
        description="This will reset all settings (units, rest timer, theme, etc.) to their defaults. Your workout data will not be affected."
        confirmText="Reset Settings"
        variant="default"
      />

      <ToastContainer />
    </div>
  );
}
