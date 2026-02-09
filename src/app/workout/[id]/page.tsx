'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '@/lib/db';
import { writeExerciseHistory } from '@/lib/queries';
import { checkAchievements, ACHIEVEMENTS } from '@/lib/achievements';
import { playSfx } from '@/lib/sfx';
import {
  detectPersonalRecords,
  type PersonalRecordSummary,
} from '@/lib/personalRecords';
import { displayToGrams } from '@/lib/calculations';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimer, useWakeLock, useHaptics } from '@/hooks';
import { useActiveWorkoutDerived } from '@/hooks/useActiveWorkoutDerived';
import {
  ExerciseDisplay,
  RestTimer,
  WeightRecap,
  WorkoutComplete,
  WorkoutTimeline,
  SetLogSheet,
  clearExerciseHistoryCache,
} from '@/components/active';
import type { NewAchievementInfo } from '@/components/active';
import {
  LoadingSpinner,
  NotFoundScreen,
} from '@/components/active/WorkoutFallbacks';
import {
  ConfirmDialog,
  ToastContainer,
  useToastStore,
  AchievementUnlockOverlay,
} from '@/components/ui';
import type { PerformedSet } from '@/types/workout';
import { VALIDATION } from '@/types/workout';

const COUNTDOWN_THRESHOLD_MS = 5000;
const COUNTDOWN_BEEP_INTERVAL_MS = 900; // ~1x per second (with margin for tick jitter)

// -----------------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------------

type WorkoutPhase = 'workout' | 'recap' | 'complete';

export default function ActiveWorkoutPage(): React.JSX.Element {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  // ---------------------------------------------------------------------------
  // Local state
  // ---------------------------------------------------------------------------

  const [showQuitConfirm, setShowQuitConfirm] = useState(false);
  const [phase, setPhase] = useState<WorkoutPhase>('workout');
  const [savedDurationSec, setSavedDurationSec] = useState(0);
  const [savedTotalSets, setSavedTotalSets] = useState(0);
  const [savedTotalVolumeG, setSavedTotalVolumeG] = useState(0);
  const [savedNewAchievements, setSavedNewAchievements] = useState<NewAchievementInfo[]>([]);
  const [achievementOverlayQueue, setAchievementOverlayQueue] = useState<NewAchievementInfo[]>([]);
  const [savedPRs, setSavedPRs] = useState<PersonalRecordSummary>({ oneRm: [], volume: [] });
  const [isSaving, setIsSaving] = useState(false);

  /** Map exerciseId -> exerciseName, populated after steps are generated. */
  const [exerciseNameMap, setExerciseNameMap] = useState<Map<string, string>>(
    new Map(),
  );
  /** Map exerciseId -> visualKey, used for exercise illustrations. */
  const [exerciseVisualMap, setExerciseVisualMap] = useState<Map<string, string>>(
    new Map(),
  );

  // ---------------------------------------------------------------------------
  // Template loading from Dexie
  // ---------------------------------------------------------------------------

  const template = useLiveQuery(
    () => db.templates.get(id).then((t) => t ?? null),
    [id],
  );

  // ---------------------------------------------------------------------------
  // Store selectors (Zustand v5 -- always use selectors)
  // ---------------------------------------------------------------------------

  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const steps = useActiveWorkoutStore((s) => s.steps);
  const currentStepIndex = useActiveWorkoutStore((s) => s.currentStepIndex);
  const performedSets = useActiveWorkoutStore((s) => s.performedSets);
  const startWorkout = useActiveWorkoutStore((s) => s.startWorkout);
  const advanceStep = useActiveWorkoutStore((s) => s.advanceStep);
  const setTimerEndTime = useActiveWorkoutStore((s) => s.setTimerEndTime);
  const upsertSet = useActiveWorkoutStore((s) => s.upsertSet);
  const endWorkoutEarly = useActiveWorkoutStore((s) => s.endWorkoutEarly);
  const completeWorkout = useActiveWorkoutStore((s) => s.completeWorkout);
  const resetStore = useActiveWorkoutStore((s) => s.reset);
  const writeCrashRecovery = useActiveWorkoutStore(
    (s) => s.writeCrashRecovery,
  );

  const globalDefaultRest = useSettingsStore(
    (s) => s.defaultRestBetweenSetsSec,
  );
  const globalDefaultTransitions = useSettingsStore(
    (s) => s.defaultTransitionsSec,
  );
  const autoStartRestTimer = useSettingsStore(
    (s) => s.autoStartRestTimer,
  );
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const weightStepsKg = useSettingsStore((s) => s.weightStepsKg);
  const weightStepsLb = useSettingsStore((s) => s.weightStepsLb);

  // Toast
  const addToast = useToastStore((s) => s.addToast);

  // ---------------------------------------------------------------------------
  // Haptics
  // ---------------------------------------------------------------------------

  const haptics = useHaptics();

  // ---------------------------------------------------------------------------
  // Derived data (step progress, exercise name, next-up label, etc.)
  // ---------------------------------------------------------------------------

  const currentStep = steps[currentStepIndex] ?? null;

  // ---------------------------------------------------------------------------
  // SetLogSheet state (inline weight logging)
  // ---------------------------------------------------------------------------

  const [showSetLogSheet, setShowSetLogSheet] = useState(false);
  /** Stores the latest weight hint from ExerciseDisplay for SetLogSheet prefill. */
  const [weightHintG, setWeightHintG] = useState<number | null>(null);

  const {
    stepProgressText,
    currentExerciseName,
    currentExerciseVisualKey,
    nextUpLabel,
    exerciseSteps,
    ariaStepAnnouncement,
  } = useActiveWorkoutDerived(
    steps,
    currentStepIndex,
    exerciseNameMap,
    exerciseVisualMap,
  );

  /** Index of the current step within the exercise-only steps array. */
  const currentExerciseStepIndex = currentStep
    ? exerciseSteps.indexOf(currentStep)
    : -1;

  // ---------------------------------------------------------------------------
  // Timer + Sound Effects
  // ---------------------------------------------------------------------------

  const [timerFinishFlash, setTimerFinishFlash] = useState(false);
  const timerAdvanceRef = useRef<number | null>(null);

  const handleTimerComplete = useCallback(() => {
    // Give a tiny "finished" beat before advancing (visual + haptic + audio).
    if (timerAdvanceRef.current !== null) return;
    setTimerFinishFlash(true);
    haptics.timerComplete();
    playSfx('timerDone');
    timerAdvanceRef.current = window.setTimeout(() => {
      timerAdvanceRef.current = null;
      setTimerFinishFlash(false);
      advanceStep();
    }, 200);
  }, [haptics, advanceStep]);

  // Countdown: plays beep 1x/sec + haptic pulse in the last 5 seconds
  const lastBeepTimeRef = useRef(0);

  const handleTimerTick = useCallback((remainingMs: number) => {
    if (remainingMs <= 0 || remainingMs > COUNTDOWN_THRESHOLD_MS) return;

    const now = Date.now();
    if (now - lastBeepTimeRef.current < COUNTDOWN_BEEP_INTERVAL_MS) return;
    lastBeepTimeRef.current = now;

    // Haptic pulse — gets stronger as we approach 0
    const { hapticFeedback } = useSettingsStore.getState();
    if (hapticFeedback && 'vibrate' in navigator) {
      const intensity = remainingMs < 2000 ? 80 : remainingMs < 3500 ? 50 : 30;
      navigator.vibrate(intensity);
    }

    // Countdown beep
    playSfx('countdown');
  }, []);

  const timer = useTimer({ onComplete: handleTimerComplete, onTick: handleTimerTick });

  useEffect(() => {
    return () => {
      if (timerAdvanceRef.current !== null) {
        clearTimeout(timerAdvanceRef.current);
        timerAdvanceRef.current = null;
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Initialize workout when template loads
  // ---------------------------------------------------------------------------

  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (template && !isActive && !hasStartedRef.current) {
      hasStartedRef.current = true;
      clearExerciseHistoryCache();
      startWorkout(
        template.id,
        template.name,
        template.blocks,
        template.defaultRestBetweenSetsSec,
        globalDefaultRest,
        globalDefaultTransitions,
      );
    }
  }, [template, isActive, startWorkout, globalDefaultRest, globalDefaultTransitions]);

  // ---------------------------------------------------------------------------
  // Fetch exercise names for all exerciseIds present in the steps
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (steps.length === 0) return;

    const exerciseIds = new Set<string>();
    for (const step of steps) {
      if (step.exerciseId) {
        exerciseIds.add(step.exerciseId);
      }
    }

    if (exerciseIds.size === 0) return;

    const fetchNames = async (): Promise<void> => {
      try {
        const ids = Array.from(exerciseIds);
        const exercises = await db.exercises.bulkGet(ids);
        const nameMap = new Map<string, string>();
        const visualMap = new Map<string, string>();

        for (let i = 0; i < ids.length; i++) {
          const exercise = exercises[i];
          if (exercise) {
            nameMap.set(exercise.id, exercise.name);
            visualMap.set(exercise.id, exercise.visualKey);
          }
        }

        setExerciseNameMap(nameMap);
        setExerciseVisualMap(visualMap);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to load exercises';
        console.error('Failed to fetch exercise names:', msg);
      }
    };

    void fetchNames();
  }, [steps]);

  // ---------------------------------------------------------------------------
  // Handle "Done" on exercise step
  // ---------------------------------------------------------------------------

  /** Manually start the rest timer for the current rest step. */
  const handleManualTimerStart = useCallback(() => {
    const step = steps[currentStepIndex];
    if (
      step &&
      (step.type === 'rest' || step.type === 'superset-rest') &&
      step.restDurationSec
    ) {
      const endTime = Date.now() + step.restDurationSec * 1000;
      setTimerEndTime(endTime);
      timer.start(step.restDurationSec);
    }
  }, [steps, currentStepIndex, setTimerEndTime, timer]);

  /** Advance to the next step and auto-start the rest timer if applicable. */
  const advanceAndStartTimer = useCallback(() => {
    advanceStep();

    if (autoStartRestTimer) {
      // Read the post-advance state directly from the store -- the closure's
      // `currentStepIndex` is still the pre-advance value.
      const { steps: currentSteps, currentStepIndex: newIdx } =
        useActiveWorkoutStore.getState();
      const nextStep = currentSteps[newIdx];
      if (
        nextStep &&
        (nextStep.type === 'rest' || nextStep.type === 'superset-rest') &&
        nextStep.restDurationSec
      ) {
        const endTime = Date.now() + nextStep.restDurationSec * 1000;
        setTimerEndTime(endTime);
        timer.start(nextStep.restDurationSec);
      }
    }
  }, [advanceStep, autoStartRestTimer, setTimerEndTime, timer]);

  const handleExerciseDone = useCallback(() => {
    if (showSetLogSheet) return; // sheet already open — ignore (double-tap guard)
    if (currentStep?.type !== 'exercise') return; // not on an exercise step
    haptics.tap();
    setShowSetLogSheet(true);
  }, [showSetLogSheet, currentStep, haptics]);

  /** Called when the user presses "Save & Rest" in the SetLogSheet. */
  const handleSetLogSave = useCallback((weightG: number, repsDone: number) => {
    // Defensive validation — the Stepper clamps values, but guard against bypass.
    const safeWeight = Number.isFinite(weightG)
      ? Math.max(0, Math.min(weightG, VALIDATION.MAX_WEIGHT_G))
      : 0;
    const safeReps = Number.isInteger(repsDone)
      ? Math.max(0, Math.min(repsDone, VALIDATION.MAX_REPS))
      : 0;

    if (currentExerciseStepIndex >= 0 && currentStep) {
      const performedSet: PerformedSet = {
        exerciseId: currentStep.exerciseId ?? '',
        exerciseNameSnapshot: currentExerciseName,
        blockPath: `block-${currentStep.blockIndex}`,
        setIndex: currentStep.setIndex ?? 0,
        repsTargetMin: currentStep.repsMin ?? 0,
        repsTargetMax: currentStep.repsMax ?? 0,
        repsDone: safeReps,
        weightG: safeWeight,
      };
      upsertSet(currentExerciseStepIndex, performedSet);
    }
    setShowSetLogSheet(false);
    advanceAndStartTimer();
  }, [currentStep, currentExerciseName, currentExerciseStepIndex, upsertSet, advanceAndStartTimer]);

  /** Called when the user presses "Skip" in the SetLogSheet. */
  const handleSetLogSkip = useCallback(() => {
    setShowSetLogSheet(false);
    advanceAndStartTimer();
  }, [advanceAndStartTimer]);

  /** Capture weight hint from ExerciseDisplay for SetLogSheet prefill. */
  const handleWeightHintReady = useCallback((avgG: number) => {
    setWeightHintG(avgG);
  }, []);

  // ---------------------------------------------------------------------------
  // Detect 'complete' step -> transition to recap phase
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (currentStep?.type === 'complete' && phase === 'workout') {
      setPhase('recap');
    }
  }, [currentStep, phase]);

  // ---------------------------------------------------------------------------
  // Crash recovery: every 30s + visibilitychange -> hidden
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Only persist crash recovery while actively running through steps.
    // Once we transition to recap/complete, keeping a recovery record around
    // would surface a bogus "Continue workout?" banner on the home screen.
    if (!isActive || phase !== 'workout') return;

    const interval = setInterval(() => {
      void writeCrashRecovery();
    }, 30_000);

    function handleVisibility(): void {
      if (document.visibilityState === 'hidden') {
        void writeCrashRecovery();
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isActive, phase, writeCrashRecovery]);

  // ---------------------------------------------------------------------------
  // Wake lock: acquire on mount, release on unmount
  // ---------------------------------------------------------------------------

  const wakeLock = useWakeLock();

  useEffect(() => {
    if (isActive) {
      void wakeLock.request();
    }
    return () => {
      void wakeLock.release();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ---------------------------------------------------------------------------
  // Body class for overscroll behavior
  // ---------------------------------------------------------------------------

  useEffect(() => {
    document.body.classList.add('workout-active');
    return () => {
      document.body.classList.remove('workout-active');
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Quit workout (go to recap)
  // ---------------------------------------------------------------------------

  const handleQuit = useCallback(() => {
    timer.stop();
    endWorkoutEarly();
    setPhase('recap');
  }, [timer, endWorkoutEarly]);

  // ---------------------------------------------------------------------------
  // Save workout (from recap -> complete)
  // ---------------------------------------------------------------------------

  const handleSaveWorkout = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const log = await completeWorkout();
      if (log) {
        try {
          const prs = await detectPersonalRecords(log);
          setSavedPRs(prs);
        } catch (prErr: unknown) {
          const prMsg = prErr instanceof Error ? prErr.message : 'Unknown error';
          console.error('Failed to detect PRs:', prMsg);
          setSavedPRs({ oneRm: [], volume: [] });
        }

        // Write denormalized exercise history for charts
        // and check achievements -- non-critical, so wrapped in try/catch
        try {
          await writeExerciseHistory(log);
        } catch (histErr: unknown) {
          const histMsg =
            histErr instanceof Error ? histErr.message : 'Unknown error';
          console.error('Failed to write exercise history:', histMsg);
        }

        try {
          const newAchievements = await checkAchievements(log);
          const enriched = newAchievements
            .map((a) => {
              const def = ACHIEVEMENTS.find((d) => d.id === a.achievementId);
              return def
                ? {
                    id: def.id,
                    name: def.name,
                    icon: def.icon,
                    iconSrc: `/visuals/badges/${def.id}.svg`,
                    context: a.context,
                  }
                : null;
            })
            .filter((a): a is NonNullable<typeof a> => a !== null);
          setSavedNewAchievements(enriched);
          setAchievementOverlayQueue(enriched);
        } catch (achErr: unknown) {
          const achMsg =
            achErr instanceof Error ? achErr.message : 'Unknown error';
          console.error('Failed to check achievements:', achMsg);
        }

        setSavedDurationSec(log.durationSec);
        setSavedTotalSets(log.performedSets.length);
        setSavedTotalVolumeG(log.totalVolumeG);
        setPhase('complete');
        haptics.success();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save';
      addToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, completeWorkout, haptics, addToast]);

  // ---------------------------------------------------------------------------
  // Finish (from complete screen -> navigate home)
  // ---------------------------------------------------------------------------

  const handleFinish = useCallback(() => {
    resetStore();
    router.push('/');
  }, [resetStore, router]);

  /** Discard workout entirely -- no data saved. */
  const handleDiscard = useCallback(async () => {
    await db.crashRecovery.delete('recovery').catch(() => {});
    resetStore();
    // Clear persisted active-workout store (sessionStorage-backed).
    sessionStorage.removeItem('workout-pwa-active-session');
    // Legacy cleanup (older builds used this key).
    sessionStorage.removeItem('active-workout');
    router.push('/');
  }, [resetStore, router]);

  // ---------------------------------------------------------------------------
  // SetLogSheet prefill values
  // ---------------------------------------------------------------------------

  const weightStepValues = unitSystem === 'kg' ? weightStepsKg : weightStepsLb;
  const weightStep = weightStepValues[0] ?? (unitSystem === 'kg' ? 2.5 : 5);

  /**
   * Prefill weight for SetLogSheet: use the weight hint from ExerciseDisplay
   * (avgG from previous session), or fall back to a sensible default.
   */
  const prefillWeightG = weightHintG
    ?? displayToGrams(unitSystem === 'kg' ? 20 : 45, unitSystem);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const activeAchievementOverlay = achievementOverlayQueue[0] ?? null;

  // Loading/not-found state: only block if we don't already have an active session.
  if (!isActive) {
    if (template === null) {
      return <NotFoundScreen onBack={() => router.push('/')} />;
    }
    return <LoadingSpinner />;
  }

  // Complete screen
  if (phase === 'complete') {
    return (
      <div className="min-h-dvh bg-background safe-bottom">
        <WorkoutComplete
          durationSec={savedDurationSec}
          totalSets={savedTotalSets}
          totalVolumeG={savedTotalVolumeG}
          personalRecords={savedPRs}
          newAchievements={savedNewAchievements}
          onFinish={handleFinish}
        />
        {activeAchievementOverlay ? (
          <AchievementUnlockOverlay
            achievement={activeAchievementOverlay}
            onDismiss={() => setAchievementOverlayQueue((q) => q.slice(1))}
          />
        ) : null}
        <ToastContainer />
      </div>
    );
  }

  // Recap screen
  if (phase === 'recap') {
    return (
      <div className="min-h-dvh bg-background safe-bottom">
        <WeightRecap
          steps={exerciseSteps}
          performedSets={performedSets}
          exerciseNameMap={exerciseNameMap}
          onUpsertSet={upsertSet}
          onComplete={handleSaveWorkout}
          onSavePartial={handleSaveWorkout}
          onDiscard={handleDiscard}
          isSaving={isSaving}
        />
        <ToastContainer />
      </div>
    );
  }

  // Active workout
  return (
    <div className="flex min-h-dvh flex-col bg-background safe-bottom">
      {/* Visually-hidden live region for screen reader step announcements */}
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {ariaStepAnnouncement}
      </div>

      {/* Top bar: X button to quit + progress */}
      <div className="flex items-center justify-between px-4 pt-[env(safe-area-inset-top)] py-3">
        <button
          type="button"
          onClick={() => setShowQuitConfirm(true)}
          className="rounded-full p-2 text-text-muted transition-colors hover:bg-surface"
          aria-label="End workout"
        >
          <X className="h-6 w-6" />
        </button>
        <span className="text-sm font-medium text-text-muted">
          {stepProgressText}
        </span>
      </div>

      {/* Main content area based on current step type */}
      <div className="flex flex-1 flex-col">
        {currentStep?.type === 'exercise' ? (
          <div key={`exercise-${currentStepIndex}`} className="flex flex-1 flex-col animate-exercise-enter">
            <ExerciseDisplay
              exerciseName={currentExerciseName}
              exerciseId={currentStep.exerciseId}
              setIndex={currentStep.setIndex ?? 0}
              totalSets={currentStep.totalSets ?? 1}
              repsMin={currentStep.repsMin ?? 1}
              repsMax={currentStep.repsMax ?? 1}
              visualKey={currentExerciseVisualKey}
              isSuperset={currentStep.isSuperset}
              supersetExerciseIndex={currentStep.supersetExerciseIndex}
              supersetTotalExercises={currentStep.supersetTotalExercises}
              onDone={handleExerciseDone}
              onWeightHintReady={handleWeightHintReady}
            />
          </div>
        ) : null}

        {currentStep?.type === 'rest' ||
        currentStep?.type === 'superset-rest' ? (
          <div key={`rest-${currentStepIndex}`} className="flex flex-1 flex-col animate-rest-enter">
            <RestTimer
              remainingMs={timer.remainingMs}
              totalMs={(currentStep.restDurationSec ?? 90) * 1000}
              isSuperset={currentStep.type === 'superset-rest'}
              ringLabel={
                currentStep.type === 'superset-rest'
                  ? 'REST'
                  : currentStep.type === 'rest' &&
                      !currentStep.isSuperset &&
                      steps[currentStepIndex + 1] &&
                      steps[currentStepIndex + 1]!.blockIndex !== currentStep.blockIndex
                    ? 'TRANSITION'
                    : 'REST'
              }
              isRunning={timer.isRunning}
              nextUpLabel={nextUpLabel}
              finishFlash={timerFinishFlash}
              onSkip={timer.skip}
              onAdjust={timer.adjust}
              onStart={handleManualTimerStart}
            />
          </div>
        ) : null}
      </div>

      {/* Workout progress timeline */}
      <WorkoutTimeline steps={steps} currentStepIndex={currentStepIndex} />

      {/* Inline set logging sheet (appears after pressing DONE) */}
      <SetLogSheet
        isOpen={showSetLogSheet}
        onSaveAndRest={handleSetLogSave}
        onSkip={handleSetLogSkip}
        exerciseName={currentExerciseName}
        setNumber={(currentStep?.setIndex ?? 0) + 1}
        totalSets={currentStep?.totalSets ?? 1}
        prefillWeightG={prefillWeightG}
        prefillReps={currentStep?.repsMax ?? 8}
        unitSystem={unitSystem}
        weightStep={weightStep}
      />

      {/* Quit confirmation dialog */}
      <ConfirmDialog
        isOpen={showQuitConfirm}
        onClose={() => setShowQuitConfirm(false)}
        onConfirm={handleQuit}
        title="End workout early?"
        description="Your progress will be saved. You can log weights for completed sets."
        confirmText="End Workout"
        variant="danger"
      />

      <ToastContainer />
    </div>
  );
}
