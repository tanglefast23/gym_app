import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { UnitSystem, ThemeMode, UserSettings } from '@/types/workout';
import { DEFAULT_SETTINGS } from '@/types/workout';

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
  weightStepsKg: number[];
  weightStepsLb: number[];
  hapticFeedback: boolean;
  soundEnabled: boolean;
  restTimerSound: boolean;
  theme: ThemeMode;
}

interface SettingsActions {
  setUnitSystem: (unit: UnitSystem) => void;
  setDefaultRest: (seconds: number) => void;
  setWeightStepsKg: (steps: number[]) => void;
  setWeightStepsLb: (steps: number[]) => void;
  toggleHapticFeedback: () => void;
  toggleSoundEnabled: () => void;
  toggleRestTimerSound: () => void;
  setTheme: (theme: ThemeMode) => void;
  resetToDefaults: () => void;
  /** Refresh Zustand state from imported UserSettings (e.g. after a backup restore). */
  rehydrateFromImport: (settings: UserSettings) => void;
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // --- data fields (defaults from DEFAULT_SETTINGS) ---
      unitSystem: DEFAULT_SETTINGS.unitSystem,
      defaultRestBetweenSetsSec: DEFAULT_SETTINGS.defaultRestBetweenSetsSec,
      weightStepsKg: DEFAULT_SETTINGS.weightStepsKg,
      weightStepsLb: DEFAULT_SETTINGS.weightStepsLb,
      hapticFeedback: DEFAULT_SETTINGS.hapticFeedback,
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      restTimerSound: DEFAULT_SETTINGS.restTimerSound,
      theme: DEFAULT_SETTINGS.theme,

      // --- actions ---
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setDefaultRest: (seconds) => set({ defaultRestBetweenSetsSec: seconds }),
      setWeightStepsKg: (steps) => set({ weightStepsKg: steps }),
      setWeightStepsLb: (steps) => set({ weightStepsLb: steps }),
      toggleHapticFeedback: () =>
        set((state) => ({ hapticFeedback: !state.hapticFeedback })),
      toggleSoundEnabled: () =>
        set((state) => ({ soundEnabled: !state.soundEnabled })),
      toggleRestTimerSound: () =>
        set((state) => ({ restTimerSound: !state.restTimerSound })),
      setTheme: (theme) => set({ theme }),
      resetToDefaults: () =>
        set({
          unitSystem: DEFAULT_SETTINGS.unitSystem,
          defaultRestBetweenSetsSec: DEFAULT_SETTINGS.defaultRestBetweenSetsSec,
          weightStepsKg: DEFAULT_SETTINGS.weightStepsKg,
          weightStepsLb: DEFAULT_SETTINGS.weightStepsLb,
          hapticFeedback: DEFAULT_SETTINGS.hapticFeedback,
          soundEnabled: DEFAULT_SETTINGS.soundEnabled,
          restTimerSound: DEFAULT_SETTINGS.restTimerSound,
          theme: DEFAULT_SETTINGS.theme,
        }),
      rehydrateFromImport: (settings: UserSettings) =>
        set({
          unitSystem: settings.unitSystem,
          defaultRestBetweenSetsSec: settings.defaultRestBetweenSetsSec,
          weightStepsKg: settings.weightStepsKg,
          weightStepsLb: settings.weightStepsLb,
          hapticFeedback: settings.hapticFeedback,
          soundEnabled: settings.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
          restTimerSound: settings.restTimerSound,
          theme: settings.theme,
        }),
    }),
    {
      name: 'workout-pwa-settings',
      partialize: (state): SettingsState => ({
        unitSystem: state.unitSystem,
        defaultRestBetweenSetsSec: state.defaultRestBetweenSetsSec,
        weightStepsKg: state.weightStepsKg,
        weightStepsLb: state.weightStepsLb,
        hapticFeedback: state.hapticFeedback,
        soundEnabled: state.soundEnabled,
        restTimerSound: state.restTimerSound,
        theme: state.theme,
      }),
    }
  )
);
