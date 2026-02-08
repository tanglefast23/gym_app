import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  TemplateBlock,
  WorkoutStep,
  PerformedSet,
  WorkoutLog,
  CrashRecoveryData,
} from '@/types/workout';
import { generateSteps, countExerciseSteps } from '@/lib/stepEngine';
import { db } from '@/lib/db';

/**
 * State describing the currently active workout session.
 *
 * IMPORTANT (Zustand v5): Always use a selector when consuming this store.
 *   Good:  useActiveWorkoutStore((s) => s.isActive)
 *   Bad:   useActiveWorkoutStore()   // subscribes to the ENTIRE store
 */
interface ActiveWorkoutState {
  /** Unique ID for the current workout session */
  sessionId: string | null;
  /** ID of the template being used, or null for ad-hoc workouts */
  templateId: string | null;
  /** Snapshot of the template name at workout start */
  templateName: string;
  /** Frozen snapshot of the template blocks at workout start */
  templateSnapshot: TemplateBlock[];
  /** Flat list of steps generated from the template blocks */
  steps: WorkoutStep[];
  /** Index into `steps` indicating the current step */
  currentStepIndex: number;
  /** Absolute timestamp (Date.now() + ms) when the current rest timer expires */
  timerEndTime: number | null;
  /** ISO timestamp when the workout session started */
  startedAt: string | null;
  /** Sets logged by the user during the workout */
  performedSets: PerformedSet[];
  /** Whether a workout is currently in progress */
  isActive: boolean;
}

interface ActiveWorkoutActions {
  /** Initialize a new workout session from a template */
  startWorkout: (
    templateId: string,
    templateName: string,
    blocks: TemplateBlock[],
    templateDefaultRest: number | null,
    globalDefaultRest: number,
  ) => void;

  /** Advance to the next step (called when "DONE" is pressed or timer completes) */
  advanceStep: () => void;

  /** Get the current step */
  getCurrentStep: () => WorkoutStep | null;

  /** Set timer end time (called when entering a rest step) */
  setTimerEndTime: (endTime: number | null) => void;

  /** Log a performed set during recap */
  logSet: (set: PerformedSet) => void;

  /** Update a performed set during recap */
  updateSet: (index: number, set: PerformedSet) => void;

  /** End workout early (partial) -- goes to recap */
  endWorkoutEarly: () => void;

  /** Complete the workout -- save log to Dexie */
  completeWorkout: () => Promise<WorkoutLog | null>;

  /** Reset store (after save or abandon) */
  reset: () => void;

  /** Write crash recovery data to IndexedDB */
  writeCrashRecovery: () => Promise<void>;

  /** Restore from crash recovery */
  restoreFromRecovery: (recovery: CrashRecoveryData) => void;
}

const initialState: ActiveWorkoutState = {
  sessionId: null,
  templateId: null,
  templateName: '',
  templateSnapshot: [],
  steps: [],
  currentStepIndex: 0,
  timerEndTime: null,
  startedAt: null,
  performedSets: [],
  isActive: false,
};

/**
 * Zustand store managing the active workout session.
 *
 * Handles step progression through generated exercise/rest steps, timer state,
 * performed-set tracking, workout completion, and crash recovery persistence.
 *
 * Persisted to sessionStorage so the session survives in-tab refreshes but
 * does not leak across tabs or survive tab closure.
 */
export const useActiveWorkoutStore = create<
  ActiveWorkoutState & ActiveWorkoutActions
>()(
  persist(
    (set, get) => ({
      // --- initial state fields ---
      ...initialState,

      // --- actions ---

      startWorkout: (
        templateId,
        templateName,
        blocks,
        templateDefaultRest,
        globalDefaultRest,
      ) => {
        const steps = generateSteps(blocks, templateDefaultRest, globalDefaultRest);
        set({
          sessionId: crypto.randomUUID(),
          templateId,
          templateName,
          templateSnapshot: blocks,
          steps,
          currentStepIndex: 0,
          timerEndTime: null,
          startedAt: new Date().toISOString(),
          performedSets: [],
          isActive: true,
        });
      },

      advanceStep: () => {
        set((state) => ({
          currentStepIndex: state.currentStepIndex + 1,
          timerEndTime: null,
        }));
      },

      getCurrentStep: () => {
        const { steps, currentStepIndex } = get();
        return steps[currentStepIndex] ?? null;
      },

      setTimerEndTime: (endTime) => {
        set({ timerEndTime: endTime });
      },

      logSet: (performedSet) => {
        set((state) => ({
          performedSets: [...state.performedSets, performedSet],
        }));
      },

      updateSet: (index, updatedSet) => {
        set((state) => {
          const next = [...state.performedSets];
          next[index] = updatedSet;
          return { performedSets: next };
        });
      },

      endWorkoutEarly: () => {
        const { steps } = get();
        const completeIndex = steps.findIndex((s) => s.type === 'complete');
        if (completeIndex !== -1) {
          set({ currentStepIndex: completeIndex, timerEndTime: null });
        }
      },

      completeWorkout: async () => {
        const {
          templateId,
          templateName,
          templateSnapshot,
          performedSets,
          startedAt,
          steps,
        } = get();

        if (!startedAt) {
          return null;
        }

        try {
          const totalExerciseSteps = countExerciseSteps(steps);
          const now = Date.now();
          const startMs = new Date(startedAt).getTime();

          const log: WorkoutLog = {
            id: crypto.randomUUID(),
            status:
              performedSets.length === totalExerciseSteps
                ? 'completed'
                : 'partial',
            templateId,
            templateName,
            templateSnapshot,
            performedSets,
            startedAt,
            endedAt: new Date().toISOString(),
            durationSec: Math.floor((now - startMs) / 1000),
            totalVolumeG: performedSets.reduce(
              (sum, s) => sum + s.weightG * s.repsDone,
              0,
            ),
          };

          await db.logs.add(log);
          await db.crashRecovery.delete('recovery');

          return log;
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to complete workout: ${message}`);
        }
      },

      reset: () => {
        set(initialState);
      },

      writeCrashRecovery: async () => {
        const { sessionId, templateSnapshot, startedAt, templateId, templateName } =
          get();

        if (!sessionId || !startedAt) {
          return;
        }

        try {
          const recoveryData: CrashRecoveryData = {
            id: 'recovery',
            sessionState: {
              id: sessionId,
              templateSnapshot,
              startedAt,
              state: 'exercising',
              timerEndsAt: null,
            },
            templateId: templateId ?? '',
            templateName,
            savedAt: new Date().toISOString(),
          };

          await db.crashRecovery.put(recoveryData);
        } catch (error: unknown) {
          const message =
            error instanceof Error ? error.message : 'Unknown error';
          // TODO: Consider surfacing this to the user via a toast
          console.error(`Failed to write crash recovery: ${message}`);
        }
      },

      restoreFromRecovery: (recovery) => {
        const steps = generateSteps(recovery.sessionState.templateSnapshot, null, 90);
        set({
          sessionId: recovery.sessionState.id,
          templateId: recovery.templateId,
          templateName: recovery.templateName,
          templateSnapshot: recovery.sessionState.templateSnapshot,
          steps,
          currentStepIndex: 0,
          timerEndTime: null,
          startedAt: recovery.sessionState.startedAt,
          performedSets: [],
          isActive: true,
        });
      },
    }),
    {
      name: 'workout-pwa-active-session',
      storage: {
        getItem: (name: string) => {
          const str = sessionStorage.getItem(name);
          return str ? JSON.parse(str) : null;
        },
        setItem: (name: string, value: unknown) => {
          sessionStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name: string) => {
          sessionStorage.removeItem(name);
        },
      },
      partialize: (state): ActiveWorkoutState => ({
        sessionId: state.sessionId,
        templateId: state.templateId,
        templateName: state.templateName,
        templateSnapshot: state.templateSnapshot,
        steps: state.steps,
        currentStepIndex: state.currentStepIndex,
        timerEndTime: state.timerEndTime,
        startedAt: state.startedAt,
        performedSets: state.performedSets,
        isActive: state.isActive,
      }),
    },
  ),
);
