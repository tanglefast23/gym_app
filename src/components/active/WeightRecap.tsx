'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Copy, CopyCheck, Check, Trash2 } from 'lucide-react';
import { Button, Stepper, ConfirmDialog } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { getLastPerformedSets } from '@/lib/queries';
import { playSfx } from '@/lib/sfx';
import {
  formatWeightValue,
  displayToGrams,
  gramsToKg,
  gramsToLb,
} from '@/lib/calculations';
import type { WorkoutStep, PerformedSet } from '@/types/workout';

interface WeightRecapProps {
  steps: WorkoutStep[];
  performedSets: Array<PerformedSet | null>;
  /** Optional map of exerciseId -> exerciseName for better display/snapshots. */
  exerciseNameMap?: Map<string, string>;
  onUpsertSet: (index: number, set: PerformedSet) => void;
  onComplete: () => void;
  onSavePartial: () => void;
  onDiscard?: () => void;
}

/** Filter to only exercise-type steps. */
function getExerciseSteps(steps: WorkoutStep[]): WorkoutStep[] {
  return steps.filter((s) => s.type === 'exercise');
}

/** Find the next exercise step that hasn't been logged yet, starting from `from`. */
function findNextUnfilledIndex(
  exerciseSteps: WorkoutStep[],
  performedSets: Array<PerformedSet | null>,
  from: number,
  /** Indices we just filled this tick (store hasn't re-rendered yet). */
  justFilled?: Set<number>,
): number {
  for (let i = from; i < exerciseSteps.length; i++) {
    if (!performedSets[i] && !justFilled?.has(i)) return i;
  }
  return -1; // All filled
}

function findPreviousSetWeight(
  performedSets: Array<PerformedSet | null>,
  exerciseId: string,
  beforeIndex: number,
): number | null {
  for (let i = Math.min(beforeIndex - 1, performedSets.length - 1); i >= 0; i--) {
    const s = performedSets[i];
    if (s && s.exerciseId === exerciseId) return s.weightG;
  }
  return null;
}

/** Look up weight from the last completed session for this exercise + set index. */
function findHistoricalWeight(
  historicalSets: Map<string, PerformedSet[]>,
  exerciseId: string,
  setIndex: number,
): number | null {
  const sets = historicalSets.get(exerciseId);
  if (!sets || sets.length === 0) return null;
  // Match by set index if available, otherwise fall back to first set
  const match = sets.find((s) => s.setIndex === setIndex);
  return (match ?? sets[0]).weightG;
}

export const WeightRecap = ({
  steps,
  performedSets,
  exerciseNameMap,
  onUpsertSet,
  onComplete,
  onSavePartial,
  onDiscard,
}: WeightRecapProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const weightStepsKg = useSettingsStore((s) => s.weightStepsKg);
  const weightStepsLb = useSettingsStore((s) => s.weightStepsLb);

  const exerciseSteps = useMemo(() => getExerciseSteps(steps), [steps]);
  const totalSets = exerciseSteps.length;

  // Keep a ref to the latest performedSets so delayed callbacks (timeouts)
  // can read fresh data instead of a stale closure snapshot.
  const performedSetsRef = useRef(performedSets);
  useEffect(() => {
    performedSetsRef.current = performedSets;
  }, [performedSets]);

  type DraftWeightSource =
    | 'existing'
    | 'previous'
    | 'history'
    | 'default'
    | 'user';

  // Default starting weight for first-time weight entry.
  // In lb mode, use a "nice" round value (30 lb) instead of ~33.1 lb.
  const firstWeightDefaultDisplay = unitSystem === 'kg' ? 15 : 30;
  const firstWeightDefaultG = displayToGrams(
    firstWeightDefaultDisplay,
    unitSystem,
  );

  // Historical weight data from previous sessions (fetched once on mount)
  const historicalSetsRef = useRef<Map<string, PerformedSet[]>>(new Map());
  const [historicalLoaded, setHistoricalLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const exerciseIds = new Set<string>();
    for (const s of exerciseSteps) {
      if (s.exerciseId) exerciseIds.add(s.exerciseId);
    }

    const fetchHistory = async (): Promise<void> => {
      const map = new Map<string, PerformedSet[]>();
      const promises = [...exerciseIds].map(async (eid) => {
        const sets = await getLastPerformedSets(eid);
        if (sets.length > 0) map.set(eid, sets);
      });
      await Promise.all(promises);
      if (!cancelled) {
        historicalSetsRef.current = map;
        setHistoricalLoaded(true);
      }
    };

    fetchHistory().catch(() => {
      if (!cancelled) setHistoricalLoaded(true);
    });

    return () => { cancelled = true; };
  }, [exerciseSteps]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [draftWeight, setDraftWeight] = useState<{
    weightG: number;
    source: DraftWeightSource;
  }>(() => {
    const step = exerciseSteps[0];
    const existing = performedSets[0];
    if (existing) return { weightG: existing.weightG, source: 'existing' };
    const prevWeight = step?.exerciseId
      ? findPreviousSetWeight(performedSets, step.exerciseId, 0)
      : null;
    if (prevWeight !== null) return { weightG: prevWeight, source: 'previous' };
    return { weightG: firstWeightDefaultG, source: 'default' };
  });
  const draftWeightG = draftWeight.weightG;
  const draftWeightSource = draftWeight.source;

  useEffect(() => {
    if (!historicalLoaded) return;
    if (draftWeightSource !== 'default') return;

    const step = exerciseSteps[currentIndex];
    if (!step?.exerciseId) return;

    const histWeight = findHistoricalWeight(
      historicalSetsRef.current,
      step.exerciseId,
      step.setIndex ?? 0,
    );

    if (histWeight !== null) {
      setDraftWeight({ weightG: histWeight, source: 'history' });
    }
  }, [historicalLoaded, currentIndex, exerciseSteps, draftWeightSource]);
  const [draftReps, setDraftReps] = useState<number>(() => {
    const step = exerciseSteps[0];
    const existing = performedSets[0];
    if (existing) return existing.repsDone;
    return step?.repsMax ?? step?.repsMin ?? 0;
  });

  const currentStep = exerciseSteps[currentIndex];
  const currentExerciseName = useMemo(() => {
    if (!currentStep) return '';
    const exerciseId = currentStep.exerciseId ?? '';
    return (
      (exerciseId ? exerciseNameMap?.get(exerciseId) : undefined) ??
      currentStep.exerciseName ??
      'Exercise'
    );
  }, [currentStep, exerciseNameMap]);

  /** Weight step in grams (uses the first weight step from settings). */
  const weightStepValues =
    unitSystem === 'kg' ? weightStepsKg : weightStepsLb;
  const weightStep = weightStepValues[0] ?? (unitSystem === 'kg' ? 2.5 : 5);
  /** Big step for the double buttons (always 5 in display units). */
  const weightBigStep = 5;
  /** Convert grams to display value for the stepper. */
  const weightDisplay =
    unitSystem === 'kg' ? gramsToKg(draftWeightG) : gramsToLb(draftWeightG);

  /** Initialize draft values when navigating to a new set. */
  const initializeDraft = useCallback(
    (index: number) => {
      const step = exerciseSteps[index];
      if (!step) return;

      const existingSet = performedSets[index];

      if (existingSet) {
        setDraftWeight({ weightG: existingSet.weightG, source: 'existing' });
        setDraftReps(existingSet.repsDone);
        return;
      }

      // Prefill reps to repsMax
      setDraftReps(step.repsMax ?? step.repsMin ?? 0);

      // Prefill weight: in-session first, then historical, then default.
      const prevWeight = step.exerciseId
        ? findPreviousSetWeight(performedSets, step.exerciseId, index)
        : null;
      if (prevWeight !== null) {
        setDraftWeight({ weightG: prevWeight, source: 'previous' });
      } else {
        const histWeight = step.exerciseId
          ? findHistoricalWeight(historicalSetsRef.current, step.exerciseId, step.setIndex ?? 0)
          : null;
        if (histWeight !== null) {
          setDraftWeight({ weightG: histWeight, source: 'history' });
        } else {
          setDraftWeight({ weightG: firstWeightDefaultG, source: 'default' });
        }
      }
    },
    [exerciseSteps, performedSets, firstWeightDefaultG],
  );

  // Visual feedback states
  const [applyFeedback, setApplyFeedback] = useState(false);
  const [sameWeightFeedback, setSameWeightFeedback] = useState(false);
  const [savingPartial, setSavingPartial] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [saveNudge, setSaveNudge] = useState(false);

  const applyTimeoutRef = useRef<number | null>(null);
  const sameWeightTimeoutRef = useRef<number | null>(null);
  const saveNudgeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (applyTimeoutRef.current !== null) {
        clearTimeout(applyTimeoutRef.current);
        applyTimeoutRef.current = null;
      }
      if (sameWeightTimeoutRef.current !== null) {
        clearTimeout(sameWeightTimeoutRef.current);
        sameWeightTimeoutRef.current = null;
      }
      if (saveNudgeTimeoutRef.current !== null) {
        clearTimeout(saveNudgeTimeoutRef.current);
        saveNudgeTimeoutRef.current = null;
      }
    };
  }, []);

  /** Save the current draft as a performed set. */
  const saveDraft = useCallback(() => {
    if (!currentStep) return;

    const performedSet: PerformedSet = {
      exerciseId: currentStep.exerciseId ?? '',
      exerciseNameSnapshot: currentExerciseName,
      blockPath: `block-${currentStep.blockIndex}`,
      setIndex: currentStep.setIndex ?? 0,
      repsTargetMin: currentStep.repsMin ?? 0,
      repsTargetMax: currentStep.repsMax ?? 0,
      repsDone: draftReps,
      weightG: draftWeightG,
    };

    onUpsertSet(currentIndex, performedSet);
  }, [
    currentStep,
    currentExerciseName,
    currentIndex,
    draftReps,
    draftWeightG,
    onUpsertSet,
  ]);

  /** Apply current weight to all remaining sets of the same exercise, then auto-advance. */
  const applyToRemaining = useCallback(() => {
    if (!currentStep?.exerciseId) return;
    const exerciseId = currentStep.exerciseId;

    // Track which indices we fill so we can skip them when looking for unfilled sets
    // (the Zustand store won't re-render performedSets until next tick).
    const justFilled = new Set<number>();

    const latestPerformed = performedSetsRef.current;
    for (let i = currentIndex; i < exerciseSteps.length; i++) {
      if (exerciseSteps[i].exerciseId !== exerciseId) continue;
      // Avoid silently overwriting already-logged sets (except the current index).
      if (i !== currentIndex && latestPerformed[i]) continue;

      const step = exerciseSteps[i];
      const set: PerformedSet = {
        exerciseId,
        exerciseNameSnapshot:
          exerciseNameMap?.get(exerciseId) ?? step.exerciseName ?? 'Exercise',
        blockPath: `block-${step.blockIndex}`,
        setIndex: step.setIndex ?? 0,
        repsTargetMin: step.repsMin ?? 0,
        repsTargetMax: step.repsMax ?? 0,
        repsDone: draftReps,
        weightG: draftWeightG,
      };

      onUpsertSet(i, set);
      justFilled.add(i);
    }

    // SFX + visual feedback
    playSfx('success');
    setApplyFeedback(true);

    // Auto-advance past filled sets after a brief visual delay
    if (applyTimeoutRef.current !== null) {
      clearTimeout(applyTimeoutRef.current);
      applyTimeoutRef.current = null;
    }
    applyTimeoutRef.current = window.setTimeout(() => {
      applyTimeoutRef.current = null;
      setApplyFeedback(false);

      // Find the next unfilled set anywhere after the current position
      const nextUnfilled = findNextUnfilledIndex(
        exerciseSteps,
        performedSetsRef.current,
        currentIndex + 1,
        justFilled,
      );

      if (nextUnfilled >= 0) {
        setCurrentIndex(nextUnfilled);
        initializeDraft(nextUnfilled);
      } else {
        // All sets filled — stay on the current set. The Save button is already visible.
        setSaveNudge(true);
        if (saveNudgeTimeoutRef.current !== null) {
          clearTimeout(saveNudgeTimeoutRef.current);
        }
        saveNudgeTimeoutRef.current = window.setTimeout(() => {
          saveNudgeTimeoutRef.current = null;
          setSaveNudge(false);
        }, 700);
      }
    }, 500);
  }, [
    currentStep,
    currentIndex,
    exerciseSteps,
    draftReps,
    draftWeightG,
    exerciseNameMap,
    onUpsertSet,
    initializeDraft,
  ]);

  /** Copy weight from the previous set of this exercise. */
  const applySameWeight = useCallback(() => {
    if (!currentStep?.exerciseId) return;
    const prevWeight = findPreviousSetWeight(
      performedSets,
      currentStep.exerciseId,
      currentIndex,
    );
    if (prevWeight !== null) {
      setDraftWeight({ weightG: prevWeight, source: 'user' });
      playSfx('success');
      setSameWeightFeedback(true);
      if (sameWeightTimeoutRef.current !== null) {
        clearTimeout(sameWeightTimeoutRef.current);
        sameWeightTimeoutRef.current = null;
      }
      sameWeightTimeoutRef.current = window.setTimeout(() => {
        sameWeightTimeoutRef.current = null;
        setSameWeightFeedback(false);
      }, 800);
    }
  }, [currentStep, performedSets, currentIndex]);

  /** Handle weight change from stepper (value in display units). */
  const handleWeightChange = useCallback(
    (displayValue: number) => {
      setDraftWeight({
        weightG: displayToGrams(displayValue, unitSystem),
        source: 'user',
      });
    },
    [unitSystem],
  );

  /** Move to next set or complete. Skips over already-logged sets. */
  const handleNext = useCallback(() => {
    const currentExerciseId = currentStep?.exerciseId ?? null;
    const currentWeightG = draftWeightG;
    saveDraft();
    if (currentIndex < totalSets - 1) {
      // Skip over already-filled sets to find the next one that needs input.
      // We pass a justFilled set containing the current index since saveDraft()
      // just saved it but performedSets won't reflect it until next render.
      const justSaved = new Set([currentIndex]);
      const nextUnfilled = findNextUnfilledIndex(
        exerciseSteps,
        performedSets,
        currentIndex + 1,
        justSaved,
      );

      const nextIndex = nextUnfilled >= 0 ? nextUnfilled : totalSets - 1;
      setCurrentIndex(nextIndex);
      const nextStep = exerciseSteps[nextIndex];

      // If the next step is the same exercise and unfilled, prefill weight
      // from the draft we just saved (Zustand won't have it yet).
      if (
        nextStep &&
        currentExerciseId &&
        nextStep.exerciseId === currentExerciseId &&
        !performedSets[nextIndex]
      ) {
        setDraftReps(nextStep.repsMax ?? nextStep.repsMin ?? 0);
        setDraftWeight({ weightG: currentWeightG, source: 'previous' });
      } else {
        initializeDraft(nextIndex);
      }
    }
  }, [
    currentStep,
    draftWeightG,
    saveDraft,
    currentIndex,
    totalSets,
    exerciseSteps,
    performedSets,
    initializeDraft,
  ]);

  /** Move to previous set. */
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      saveDraft();
      const prevIndex = currentIndex - 1;
      setCurrentIndex(prevIndex);
      initializeDraft(prevIndex);
    }
  }, [saveDraft, currentIndex, initializeDraft]);

  /** Handle complete: save current draft then call onComplete. */
  const handleComplete = useCallback(() => {
    saveDraft();
    onComplete();
  }, [saveDraft, onComplete]);

  const loggedCount = useMemo(
    () => performedSets.filter((s) => s != null).length,
    [performedSets],
  );

  /** Count sets for current exercise. */
  const currentExerciseSets = useMemo(() => {
    if (!currentStep?.exerciseId) return { current: 0, total: 0 };
    let count = 0;
    let current = 0;
    for (const step of exerciseSteps) {
      if (step.exerciseId === currentStep.exerciseId) {
        count++;
        if (step === currentStep) current = count;
      }
    }
    return { current, total: count };
  }, [currentStep, exerciseSteps]);

  const allSetsLogged = loggedCount >= totalSets;
  const hasPreviousSetWeight =
    currentStep?.exerciseId
      ? findPreviousSetWeight(performedSets, currentStep.exerciseId, currentIndex) !==
        null
      : false;

  if (!currentStep) return null;

  return (
    <div className="flex h-full flex-col px-6 py-6">
      {/* Header */}
      <h2 className="text-center text-2xl font-bold text-text-primary">
        Log Your Weights
      </h2>

      {/* Progress */}
      <p className="mt-2 text-center text-sm text-text-secondary">
        {loggedCount}/{totalSets} sets logged
      </p>

      {/* Current set card */}
      <div className="mt-6 flex-1">
        <div className="rounded-2xl bg-surface p-6">
          {/* Exercise name */}
          <h3 className="text-center text-lg font-semibold text-text-primary">
            {currentExerciseName}
          </h3>

          {/* Set indicator */}
          <p className="mt-1 text-center text-sm text-text-secondary">
            Set {currentExerciseSets.current} of {currentExerciseSets.total}
          </p>

          {/* Weight stepper */}
          <div className="mt-6">
            <Stepper
              value={weightDisplay}
              onChange={handleWeightChange}
              step={weightStep}
              bigStep={weightBigStep}
              min={0}
              label={`Weight (${unitSystem})`}
              formatValue={(v) =>
                formatWeightValue(
                  displayToGrams(v, unitSystem),
                  unitSystem,
                )
              }
            />
          </div>

          {/* Reps stepper */}
          <div className="mt-4">
            <Stepper
              value={draftReps}
              onChange={setDraftReps}
              step={1}
              min={0}
              max={999}
              label="Reps"
            />
          </div>

          {/* Quick action buttons */}
          <div className="mt-4 flex gap-3">
            {/* Same weight button */}
            <button
              type="button"
              onClick={applySameWeight}
              disabled={!hasPreviousSetWeight}
              aria-label="Copy weight from previous set"
              className={[
                'flex flex-1 items-center justify-center gap-2',
                'rounded-xl px-3 py-2.5',
                'text-sm font-medium',
                'transition-all duration-200',
                sameWeightFeedback
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-elevated text-text-secondary',
                hasPreviousSetWeight && !sameWeightFeedback
                  ? 'hover:bg-surface active:scale-[0.97]'
                  : '',
                !hasPreviousSetWeight ? 'opacity-50 cursor-not-allowed' : '',
              ].join(' ')}
            >
              {sameWeightFeedback ? (
                <Check className="h-4 w-4 animate-check-pop" />
              ) : (
                <CopyCheck className="h-4 w-4" />
              )}
              {sameWeightFeedback ? 'Applied!' : 'Same weight'}
            </button>

            {/* Apply to remaining button */}
            <button
              type="button"
              onClick={applyToRemaining}
              disabled={applyFeedback}
              aria-label="Apply current weight to all remaining sets of this exercise"
              className={[
                'flex flex-1 items-center justify-center gap-2',
                'rounded-xl px-3 py-2.5',
                'text-sm font-medium',
                'transition-all duration-200',
                applyFeedback
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-elevated text-text-secondary hover:bg-surface active:scale-[0.97]',
              ].join(' ')}
            >
              {applyFeedback ? (
                <Check className="h-4 w-4 animate-check-pop" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {applyFeedback ? 'Applied!' : 'Apply to remaining'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={handlePrevious}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </Button>

        {currentIndex < totalSets - 1 ? (
          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : null}
      </div>

      {/* Save buttons */}
      <div className="mt-4 flex flex-col gap-2">
        {allSetsLogged ? (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={handleComplete}
            className={saveNudge ? 'animate-pulse-glow' : ''}
          >
            Save Workout
          </Button>
        ) : null}

        <button
          type="button"
          disabled={savingPartial}
          onClick={() => {
            saveDraft();
            playSfx('success');
            setSavingPartial(true);
            setTimeout(() => onSavePartial(), 500);
          }}
          className={[
            'flex w-full items-center justify-center gap-2',
            'rounded-xl border px-4 py-3',
            'text-sm font-medium',
            'transition-all duration-200',
            savingPartial
              ? 'border-success/40 bg-success/20 text-success'
              : 'border-border bg-transparent text-text-secondary hover:bg-elevated active:scale-[0.97]',
          ].join(' ')}
        >
          {savingPartial ? (
            <Check className="h-4 w-4 animate-check-pop" />
          ) : null}
          {savingPartial ? 'Saving...' : 'Save Partial'}
        </button>

        {/* Discard workout button */}
        {onDiscard ? (
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(true)}
            className={[
              'flex w-full items-center justify-center gap-2',
              'rounded-xl px-4 py-3',
              'text-sm font-medium text-danger',
              'transition-all duration-150',
              'hover:bg-danger/10 active:scale-[0.97]',
            ].join(' ')}
          >
            <Trash2 className="h-4 w-4" />
            Discard Workout
          </button>
        ) : null}
      </div>

      {/* Discard confirmation */}
      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
        onConfirm={() => {
          setShowDiscardConfirm(false);
          onDiscard?.();
        }}
        title="Discard workout?"
        description="This will delete the entire workout session. No data will be saved."
        confirmText="Discard"
        variant="danger"
      />
    </div>
  );
};
