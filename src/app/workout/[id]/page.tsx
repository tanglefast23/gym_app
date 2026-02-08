'use client';

import { useEffect, useCallback, useState, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { X, Loader2 } from 'lucide-react';
import { db } from '@/lib/db';
import { writeExerciseHistory } from '@/lib/queries';
import { checkAchievements, ACHIEVEMENTS } from '@/lib/achievements';
import { playSfx } from '@/lib/sfx';
import { useActiveWorkoutStore } from '@/stores/activeWorkoutStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTimer, useWakeLock, useHaptics } from '@/hooks';
import {
  ExerciseDisplay,
  RestTimer,
  WeightRecap,
  WorkoutComplete,
} from '@/components/active';
import { Button, ConfirmDialog, ToastContainer, useToastStore } from '@/components/ui';
import type { WorkoutStep } from '@/types/workout';

const COUNTDOWN_THRESHOLD_MS = 5000;
const COUNTDOWN_BEEP_INTERVAL_MS = 500; // 2x per second

// -----------------------------------------------------------------------------
// Helper: build a "next up" label from the rest of the step list
// -----------------------------------------------------------------------------

/**
 * Scans forward from the current rest step to find the next exercise step
 * and returns a human-readable preview string.
 */
function buildNextUpLabel(
  allSteps: WorkoutStep[],
  currentIndex: number,
  nameMap: Map<string, string>,
): string {
  for (let i = currentIndex + 1; i < allSteps.length; i++) {
    const step = allSteps[i];
    if (step.type === 'exercise') {
      const name =
        nameMap.get(step.exerciseId ?? '') ??
        step.exerciseName ??
        'Exercise';
      const set = (step.setIndex ?? 0) + 1;
      return `Next: ${name} - Set ${set}`;
    }
  }
  return 'Workout complete!';
}

// -----------------------------------------------------------------------------
// Loading spinner shown while the template is being fetched from Dexie
// -----------------------------------------------------------------------------

function LoadingSpinner(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  );
}

function NotFoundScreen({ onBack }: { onBack: () => void }): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Workout not found
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          This workout template may have been deleted.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={onBack}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}

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

  // Toast
  const addToast = useToastStore((s) => s.addToast);

  // ---------------------------------------------------------------------------
  // Haptics
  // ---------------------------------------------------------------------------

  const haptics = useHaptics();

  // ---------------------------------------------------------------------------
  // Timer + Sound Effects
  // ---------------------------------------------------------------------------

  const handleTimerComplete = useCallback(() => {
    haptics.timerComplete();
    playSfx('timerDone');
    advanceStep();
  }, [haptics, advanceStep]);

  // Countdown: plays beep 2x/sec + haptic pulse in the last 5 seconds
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

  // ---------------------------------------------------------------------------
  // Current step
  // ---------------------------------------------------------------------------

  const currentStep: WorkoutStep | null = steps[currentStepIndex] ?? null;

  // ---------------------------------------------------------------------------
  // Initialize workout when template loads
  // ---------------------------------------------------------------------------

  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (template && !isActive && !hasStartedRef.current) {
      hasStartedRef.current = true;
      startWorkout(
        template.id,
        template.name,
        template.blocks,
        template.defaultRestBetweenSetsSec,
        globalDefaultRest,
      );
    }
  }, [template, isActive, startWorkout, globalDefaultRest]);

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

  const handleExerciseDone = useCallback(() => {
    haptics.tap();
    advanceStep();

    // If the next step is a rest step, start the timer
    const nextStep = steps[currentStepIndex + 1];
    if (
      nextStep &&
      (nextStep.type === 'rest' || nextStep.type === 'superset-rest') &&
      nextStep.restDurationSec
    ) {
      const endTime = Date.now() + nextStep.restDurationSec * 1000;
      setTimerEndTime(endTime);
      timer.start(nextStep.restDurationSec);
    }
  }, [haptics, advanceStep, steps, currentStepIndex, setTimerEndTime, timer]);

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
          for (const achievement of newAchievements) {
            const def = ACHIEVEMENTS.find(
              (a) => a.id === achievement.achievementId,
            );
            if (def) {
              addToast(`\u{1F3C6} ${def.name} unlocked!`, 'success');
            }
          }
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

  // ---------------------------------------------------------------------------
  // Exercise steps for recap (memoised filter)
  // ---------------------------------------------------------------------------

  const exerciseSteps = useMemo(
    () => steps.filter((s) => s.type === 'exercise'),
    [steps],
  );

  // ---------------------------------------------------------------------------
  // Step progress display
  // ---------------------------------------------------------------------------

  const stepProgressText = useMemo(() => {
    // Show progress as "current exercise step / total exercise steps"
    const exerciseOnly = steps.filter((s) => s.type === 'exercise');
    const total = exerciseOnly.length;
    let currentExIdx = 0;
    for (let i = 0; i <= currentStepIndex && i < steps.length; i++) {
      if (steps[i].type === 'exercise') {
        currentExIdx++;
      }
    }
    return `${Math.min(currentExIdx, total)} / ${total}`;
  }, [steps, currentStepIndex]);

  // ---------------------------------------------------------------------------
  // Resolve the exercise name for the current step
  // ---------------------------------------------------------------------------

  const currentExerciseName = useMemo(() => {
    if (!currentStep || currentStep.type !== 'exercise') return '';
    return (
      exerciseNameMap.get(currentStep.exerciseId ?? '') ??
      currentStep.exerciseName ??
      'Exercise'
    );
  }, [currentStep, exerciseNameMap]);

  const currentExerciseVisualKey = useMemo(() => {
    if (!currentStep || currentStep.type !== 'exercise') return undefined;
    return exerciseVisualMap.get(currentStep.exerciseId ?? '') ?? currentStep.visualKey;
  }, [currentStep, exerciseVisualMap]);

  // ---------------------------------------------------------------------------
  // Next-up label for rest timer
  // ---------------------------------------------------------------------------

  const nextUpLabel = useMemo(
    () => buildNextUpLabel(steps, currentStepIndex, exerciseNameMap),
    [steps, currentStepIndex, exerciseNameMap],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

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
          onFinish={handleFinish}
        />
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
        />
        <ToastContainer />
      </div>
    );
  }

  // Active workout
  return (
    <div className="flex min-h-dvh flex-col bg-background safe-bottom">
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
          <ExerciseDisplay
            exerciseName={currentExerciseName}
            setIndex={currentStep.setIndex ?? 0}
            totalSets={currentStep.totalSets ?? 1}
            repsMin={currentStep.repsMin ?? 1}
            repsMax={currentStep.repsMax ?? 1}
            visualKey={currentExerciseVisualKey}
            isSuperset={currentStep.isSuperset}
            supersetExerciseIndex={currentStep.supersetExerciseIndex}
            supersetTotalExercises={currentStep.supersetTotalExercises}
            onDone={handleExerciseDone}
          />
        ) : null}

        {currentStep?.type === 'rest' ||
        currentStep?.type === 'superset-rest' ? (
          <RestTimer
            remainingMs={timer.remainingMs}
            totalMs={(currentStep.restDurationSec ?? 90) * 1000}
            isSuperset={currentStep.type === 'superset-rest'}
            nextUpLabel={nextUpLabel}
            onSkip={timer.skip}
            onAdjust={timer.adjust}
          />
        ) : null}
      </div>

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
