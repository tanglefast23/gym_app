import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { UnitSystem, ThemeMode, Sex, UserSettings } from '@/types/workout';
import { DEFAULT_SETTINGS } from '@/types/workout';
import { autoIncrementAge } from '@/lib/age';

/**
 * Shape of the persisted settings data.
 * Matches UserSettings minus the static `id` field.
 *
 * IMPORTANT (Zustand v5): Always use a selector when consuming this store.
 *   Good:  useSettingsStore((s) => s.unitSystem)
 *   Bad:   useSettingsStore()   // subscribes to the ENTIRE store
 */
interface SettingsState {
  unitSystem: UnitSystem;
  defaultRestBetweenSetsSec: number;
  defaultTransitionsSec: number;
  weightStepsKg: number[];
  weightStepsLb: number[];
  hapticFeedback: boolean;
  soundEnabled: boolean;
  restTimerSound: boolean;
  autoStartRestTimer: boolean;
  theme: ThemeMode;
  heightCm: number | null;
  age: number | null;
  ageUpdatedAt: string | null;
  sex: Sex | null;
}

/** The SettingsState field names, used to pick/spread only data fields. */
const SETTINGS_KEYS: readonly (keyof SettingsState)[] = [
  'unitSystem',
  'defaultRestBetweenSetsSec',
  'defaultTransitionsSec',
  'weightStepsKg',
  'weightStepsLb',
  'hapticFeedback',
  'soundEnabled',
  'restTimerSound',
  'autoStartRestTimer',
  'theme',
  'heightCm',
  'age',
  'ageUpdatedAt',
  'sex',
] as const;

/**
 * Default values for every SettingsState field, derived from the canonical
 * DEFAULT_SETTINGS in types/workout.ts. Strips the `id` field so this is
 * a pure SettingsState.
 */
const STATE_DEFAULTS: SettingsState = (() => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...rest } = DEFAULT_SETTINGS;
  return rest;
})();

/** Pick only SettingsState keys from an arbitrary object. */
function pickSettingsState(source: Record<string, unknown>): SettingsState {
  const result = {} as Record<string, unknown>;
  for (const key of SETTINGS_KEYS) {
    result[key] = source[key as string];
  }
  return result as unknown as SettingsState;
}

interface SettingsActions {
  setUnitSystem: (unit: UnitSystem) => void;
  setDefaultRest: (seconds: number) => void;
  setDefaultTransitions: (seconds: number) => void;
  setWeightStepsKg: (steps: number[]) => void;
  setWeightStepsLb: (steps: number[]) => void;
  toggleHapticFeedback: () => void;
  toggleSoundEnabled: () => void;
  toggleRestTimerSound: () => void;
  toggleAutoStartRestTimer: () => void;
  setTheme: (theme: ThemeMode) => void;
  setHeightCm: (cm: number | null) => void;
  setAge: (age: number | null) => void;
  setSex: (sex: Sex | null) => void;
  resetToDefaults: () => void;
  /** Refresh Zustand state from imported UserSettings (e.g. after a backup restore). */
  rehydrateFromImport: (settings: UserSettings) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // --- data fields (spread from centralized defaults) ---
      ...STATE_DEFAULTS,

      // --- actions ---
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setDefaultRest: (seconds) => set({ defaultRestBetweenSetsSec: seconds }),
      setDefaultTransitions: (seconds) => set({ defaultTransitionsSec: seconds }),
      setWeightStepsKg: (steps) => set({ weightStepsKg: steps }),
      setWeightStepsLb: (steps) => set({ weightStepsLb: steps }),
      toggleHapticFeedback: () =>
        set((state) => ({ hapticFeedback: !state.hapticFeedback })),
      toggleSoundEnabled: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleRestTimerSound: () =>
        set((state) => ({ restTimerSound: !state.restTimerSound })),
      toggleAutoStartRestTimer: () =>
        set((state) => ({ autoStartRestTimer: !state.autoStartRestTimer })),
      setTheme: (theme) => set({ theme }),
      setHeightCm: (heightCm) => set({ heightCm }),
      setAge: (age) =>
        set({
          age,
          ageUpdatedAt: age == null ? null : new Date().toISOString(),
        }),
      setSex: (sex) => set({ sex }),
      resetToDefaults: () => set(STATE_DEFAULTS),
      rehydrateFromImport: (settings: UserSettings) =>
        set({
          unitSystem: settings.unitSystem,
          defaultRestBetweenSetsSec: settings.defaultRestBetweenSetsSec,
          defaultTransitionsSec:
            settings.defaultTransitionsSec ?? STATE_DEFAULTS.defaultTransitionsSec,
          weightStepsKg: settings.weightStepsKg,
          weightStepsLb: settings.weightStepsLb,
          hapticFeedback: settings.hapticFeedback,
          soundEnabled: settings.soundEnabled ?? STATE_DEFAULTS.soundEnabled,
          restTimerSound: settings.restTimerSound,
          autoStartRestTimer:
            settings.autoStartRestTimer ?? STATE_DEFAULTS.autoStartRestTimer,
          theme: settings.theme,
          heightCm: settings.heightCm ?? STATE_DEFAULTS.heightCm,
          age: settings.age ?? STATE_DEFAULTS.age,
          ageUpdatedAt:
            settings.ageUpdatedAt ??
            (settings.age != null ? new Date().toISOString() : STATE_DEFAULTS.ageUpdatedAt),
          sex: settings.sex ?? STATE_DEFAULTS.sex,
        }),
    }),
    {
      name: 'workout-pwa-settings',
      partialize: (state) => pickSettingsState(state as unknown as Record<string, unknown>),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const next = autoIncrementAge({
          age: state.age,
          ageUpdatedAt: state.ageUpdatedAt,
        });
        if (next.age !== state.age || next.ageUpdatedAt !== state.ageUpdatedAt) {
          useSettingsStore.setState(next);
        }
      },
    }
  )
);
