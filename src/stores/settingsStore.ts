import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { UnitSystem, ThemeMode, Sex, UserSettings } from '@/types/workout';
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
  sex: Sex | null;
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
      // --- data fields (defaults from DEFAULT_SETTINGS) ---
      unitSystem: DEFAULT_SETTINGS.unitSystem,
      defaultRestBetweenSetsSec: DEFAULT_SETTINGS.defaultRestBetweenSetsSec,
      defaultTransitionsSec: DEFAULT_SETTINGS.defaultTransitionsSec,
      weightStepsKg: DEFAULT_SETTINGS.weightStepsKg,
      weightStepsLb: DEFAULT_SETTINGS.weightStepsLb,
      hapticFeedback: DEFAULT_SETTINGS.hapticFeedback,
      soundEnabled: DEFAULT_SETTINGS.soundEnabled,
      restTimerSound: DEFAULT_SETTINGS.restTimerSound,
      autoStartRestTimer: DEFAULT_SETTINGS.autoStartRestTimer,
      theme: DEFAULT_SETTINGS.theme,
      heightCm: DEFAULT_SETTINGS.heightCm,
      age: DEFAULT_SETTINGS.age,
      sex: DEFAULT_SETTINGS.sex,

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
      setAge: (age) => set({ age }),
      setSex: (sex) => set({ sex }),
      resetToDefaults: () =>
        set({
          unitSystem: DEFAULT_SETTINGS.unitSystem,
          defaultRestBetweenSetsSec: DEFAULT_SETTINGS.defaultRestBetweenSetsSec,
          defaultTransitionsSec: DEFAULT_SETTINGS.defaultTransitionsSec,
          weightStepsKg: DEFAULT_SETTINGS.weightStepsKg,
          weightStepsLb: DEFAULT_SETTINGS.weightStepsLb,
          hapticFeedback: DEFAULT_SETTINGS.hapticFeedback,
          soundEnabled: DEFAULT_SETTINGS.soundEnabled,
          restTimerSound: DEFAULT_SETTINGS.restTimerSound,
          autoStartRestTimer: DEFAULT_SETTINGS.autoStartRestTimer,
          theme: DEFAULT_SETTINGS.theme,
          heightCm: DEFAULT_SETTINGS.heightCm,
          age: DEFAULT_SETTINGS.age,
          sex: DEFAULT_SETTINGS.sex,
        }),
      rehydrateFromImport: (settings: UserSettings) =>
        set({
          unitSystem: settings.unitSystem,
          defaultRestBetweenSetsSec: settings.defaultRestBetweenSetsSec,
          defaultTransitionsSec:
            settings.defaultTransitionsSec ?? DEFAULT_SETTINGS.defaultTransitionsSec,
          weightStepsKg: settings.weightStepsKg,
          weightStepsLb: settings.weightStepsLb,
          hapticFeedback: settings.hapticFeedback,
          soundEnabled: settings.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
          restTimerSound: settings.restTimerSound,
          autoStartRestTimer: settings.autoStartRestTimer ?? DEFAULT_SETTINGS.autoStartRestTimer,
          theme: settings.theme,
          heightCm: settings.heightCm ?? DEFAULT_SETTINGS.heightCm,
          age: settings.age ?? DEFAULT_SETTINGS.age,
          sex: settings.sex ?? DEFAULT_SETTINGS.sex,
        }),
    }),
    {
      name: 'workout-pwa-settings',
      partialize: (state): SettingsState => ({
        unitSystem: state.unitSystem,
        defaultRestBetweenSetsSec: state.defaultRestBetweenSetsSec,
        defaultTransitionsSec: state.defaultTransitionsSec,
        weightStepsKg: state.weightStepsKg,
        weightStepsLb: state.weightStepsLb,
        hapticFeedback: state.hapticFeedback,
        soundEnabled: state.soundEnabled,
        restTimerSound: state.restTimerSound,
        autoStartRestTimer: state.autoStartRestTimer,
        theme: state.theme,
        heightCm: state.heightCm,
        age: state.age,
        sex: state.sex,
      }),
    }
  )
);
