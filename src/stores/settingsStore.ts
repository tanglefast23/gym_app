import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { UnitSystem, ThemeMode } from '@/types/workout';
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
  restTimerSound: boolean;
  theme: ThemeMode;
}

interface SettingsActions {
  setUnitSystem: (unit: UnitSystem) => void;
  setDefaultRest: (seconds: number) => void;
  setWeightStepsKg: (steps: number[]) => void;
  setWeightStepsLb: (steps: number[]) => void;
  toggleHapticFeedback: () => void;
  toggleRestTimerSound: () => void;
  setTheme: (theme: ThemeMode) => void;
  resetToDefaults: () => void;
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
      restTimerSound: DEFAULT_SETTINGS.restTimerSound,
      theme: DEFAULT_SETTINGS.theme,

      // --- actions ---
      setUnitSystem: (unitSystem) => set({ unitSystem }),
      setDefaultRest: (seconds) => set({ defaultRestBetweenSetsSec: seconds }),
      setWeightStepsKg: (steps) => set({ weightStepsKg: steps }),
      setWeightStepsLb: (steps) => set({ weightStepsLb: steps }),
      toggleHapticFeedback: () =>
        set((state) => ({ hapticFeedback: !state.hapticFeedback })),
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
          restTimerSound: DEFAULT_SETTINGS.restTimerSound,
          theme: DEFAULT_SETTINGS.theme,
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
        restTimerSound: state.restTimerSound,
        theme: state.theme,
      }),
    }
  )
);
