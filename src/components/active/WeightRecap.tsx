'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { playSfx } from '@/lib/sfx';
import {
  displayToGrams,
  gramsToKg,
  gramsToLb,
} from '@/lib/calculations';
import type { WorkoutStep, PerformedSet } from '@/types/workout';
import {
  useWeightPrefill,
  findNextUnfilledIndex,
  findPreviousSetWeight,
  findHistoricalWeight,
} from '@/hooks/useWeightPrefill';
import { RecapSetCard } from './RecapSetCard';
import { RecapNavigation } from './RecapNavigation';
import { WorkoutTimeline } from './WorkoutTimeline';

/* ── Types ─────────────────────────────────────────────────────────── */

interface WeightRecapProps {
  steps: WorkoutStep[];
  performedSets: Array<PerformedSet | null>;
  /** Optional map of exerciseId -> exerciseName for better display/snapshots. */
  exerciseNameMap?: Map<string, string>;
  onUpsertSet: (index: number, set: PerformedSet) => void;
  onComplete: () => void;
  onSavePartial: () => void;
  onDiscard?: () => void;
  /** When true, the Save Workout button shows a loading state. */
  isSaving?: boolean;
}

/** Filter to only exercise-type steps. */
function getExerciseSteps(steps: WorkoutStep[]): WorkoutStep[] {
  return steps.filter((s) => s.type === 'exercise');
}

/* ── Component ─────────────────────────────────────────────────────── */

export const WeightRecap = ({
  steps,
  performedSets,
  exerciseNameMap,
  onUpsertSet,
  onComplete,
  onSavePartial,
  onDiscard,
  isSaving,
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

  // Weight prefill hook (handles history fetch, draft state, initialization)
  const {
    draftWeight,
    setDraftWeight,
    draftReps,
    setDraftReps,
    historicalSetsRef,
    historicalLoaded,
    initializeDraft,
  } = useWeightPrefill(exerciseSteps, performedSets);

  const draftWeightG = draftWeight.weightG;
  const draftWeightSource = draftWeight.source;

  const [currentIndex, setCurrentIndex] = useState(() => {
    const firstUnfilled = findNextUnfilledIndex(exerciseSteps, performedSets, 0);
    return firstUnfilled >= 0 ? firstUnfilled : 0;
  });

  /** True when every exercise set was already logged inline (via SetLogSheet). */
  const allLoggedInline = useMemo(
    () => findNextUnfilledIndex(exerciseSteps, performedSets, 0) === -1,
    [exerciseSteps, performedSets],
  );

  // When historical data loads and we're still on default, upgrade to history.
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
  }, [historicalLoaded, currentIndex, exerciseSteps, draftWeightSource, historicalSetsRef, setDraftWeight]);

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

  /** Weight step in display units (uses the first weight step from settings). */
  const weightStepValues =
    unitSystem === 'kg' ? weightStepsKg : weightStepsLb;
  const weightStep = weightStepValues[0] ?? (unitSystem === 'kg' ? 2.5 : 5);
  /** Big step for the double buttons (always 5 in display units). */
  const weightBigStep = 5;
  /** Convert grams to display value for the stepper. */
  const weightDisplay =
    unitSystem === 'kg' ? gramsToKg(draftWeightG) : gramsToLb(draftWeightG);

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
      if (applyTimeoutRef.current !== null) clearTimeout(applyTimeoutRef.current);
      if (sameWeightTimeoutRef.current !== null) clearTimeout(sameWeightTimeoutRef.current);
      if (saveNudgeTimeoutRef.current !== null) clearTimeout(saveNudgeTimeoutRef.current);
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
  }, [currentStep, currentExerciseName, currentIndex, draftReps, draftWeightG, onUpsertSet]);

  /** Apply current weight to all remaining sets of the same exercise, then auto-advance. */
  const applyToRemaining = useCallback(() => {
    if (!currentStep?.exerciseId) return;
    if (applyTimeoutRef.current) clearTimeout(applyTimeoutRef.current);
    const exerciseId = currentStep.exerciseId;

    const justFilled = new Set<number>();
    const latestPerformed = performedSetsRef.current;

    for (let i = currentIndex; i < exerciseSteps.length; i++) {
      if (exerciseSteps[i].exerciseId !== exerciseId) continue;
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

    playSfx('success');
    setApplyFeedback(true);

    if (applyTimeoutRef.current !== null) clearTimeout(applyTimeoutRef.current);
    applyTimeoutRef.current = window.setTimeout(() => {
      applyTimeoutRef.current = null;
      setApplyFeedback(false);

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
        const lastIndex = exerciseSteps.length - 1;
        setCurrentIndex(lastIndex);

        if (justFilled.has(lastIndex)) {
          setDraftReps(draftReps);
          setDraftWeight({ weightG: draftWeightG, source: 'existing' });
        } else {
          initializeDraft(lastIndex);
        }

        setSaveNudge(true);
        if (saveNudgeTimeoutRef.current !== null) clearTimeout(saveNudgeTimeoutRef.current);
        saveNudgeTimeoutRef.current = window.setTimeout(() => {
          saveNudgeTimeoutRef.current = null;
          setSaveNudge(false);
        }, 700);
      }
    }, 500);
  }, [
    currentStep, currentIndex, exerciseSteps, draftReps, draftWeightG,
    exerciseNameMap, onUpsertSet, initializeDraft, setDraftReps, setDraftWeight,
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
      if (sameWeightTimeoutRef.current !== null) clearTimeout(sameWeightTimeoutRef.current);
      sameWeightTimeoutRef.current = window.setTimeout(() => {
        sameWeightTimeoutRef.current = null;
        setSameWeightFeedback(false);
      }, 800);
    }
  }, [currentStep, performedSets, currentIndex, setDraftWeight]);

  /** Handle weight change from stepper (value in display units). */
  const handleWeightChange = useCallback(
    (displayValue: number) => {
      setDraftWeight({
        weightG: displayToGrams(displayValue, unitSystem),
        source: 'user',
      });
    },
    [unitSystem, setDraftWeight],
  );

  /** Move to next set or complete. Skips over already-logged sets. */
  const handleNext = useCallback(() => {
    const currentExerciseId = currentStep?.exerciseId ?? null;
    const currentWeightG = draftWeightG;
    saveDraft();

    if (currentIndex < totalSets - 1) {
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
    currentStep, draftWeightG, saveDraft, currentIndex, totalSets,
    exerciseSteps, performedSets, initializeDraft, setDraftReps, setDraftWeight,
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

  /** Lock in edits during final review without changing the current position. */
  const handleUpdate = useCallback(() => {
    saveDraft();
    playSfx('success');
  }, [saveDraft]);

  /** Handle save partial: save draft, play SFX, then call onSavePartial after delay. */
  const handleSavePartial = useCallback(() => {
    saveDraft();
    playSfx('success');
    setSavingPartial(true);
    setTimeout(() => onSavePartial(), 500);
  }, [saveDraft, onSavePartial]);

  // Derived state
  const loggedCount = useMemo(
    () => performedSets.filter((s) => s != null).length,
    [performedSets],
  );

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
      ? findPreviousSetWeight(performedSets, currentStep.exerciseId, currentIndex) !== null
      : false;
  const isFinalSet = currentIndex === totalSets - 1;
  const isFinalReview = allSetsLogged;

  const hasRemainingSetsForExercise = useMemo(() => {
    const exerciseId = currentStep?.exerciseId;
    if (!exerciseId) return false;
    for (let i = currentIndex + 1; i < exerciseSteps.length; i++) {
      if (exerciseSteps[i].exerciseId !== exerciseId) continue;
      if (!performedSets[i]) return true;
    }
    return false;
  }, [currentStep, currentIndex, exerciseSteps, performedSets]);

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

      {/* All-sets-logged banner when everything was captured inline */}
      {allLoggedInline ? (
        <div className="mt-3 rounded-xl bg-success/10 px-4 py-2.5 text-center text-sm font-medium text-success">
          All sets logged — review or save
        </div>
      ) : null}

      {/* Current set card */}
      <RecapSetCard
        exerciseName={currentExerciseName}
        currentSetNumber={currentExerciseSets.current}
        totalExerciseSets={currentExerciseSets.total}
        weightDisplay={weightDisplay}
        weightStep={weightStep}
        weightBigStep={weightBigStep}
        unitSystem={unitSystem}
        onWeightChange={handleWeightChange}
        draftReps={draftReps}
        onRepsChange={setDraftReps}
        isFinalReview={isFinalReview}
        hasPreviousSetWeight={hasPreviousSetWeight}
        onApplySameWeight={applySameWeight}
        sameWeightFeedback={sameWeightFeedback}
        hasRemainingSetsForExercise={hasRemainingSetsForExercise}
        isFinalSet={isFinalSet}
        onApplyToRemaining={applyToRemaining}
        applyFeedback={applyFeedback}
      />

      {/* Navigation + save/discard actions */}
      <RecapNavigation
        currentIndex={currentIndex}
        totalSets={totalSets}
        allSetsLogged={allSetsLogged}
        isFinalReview={isFinalReview}
        isFinalSet={isFinalSet}
        isSaving={isSaving ?? false}
        saveNudge={saveNudge}
        savingPartial={savingPartial}
        onUpdate={handleUpdate}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onComplete={handleComplete}
        onSavePartial={handleSavePartial}
        onDiscard={onDiscard}
        showDiscardConfirm={showDiscardConfirm}
        onSetShowDiscardConfirm={setShowDiscardConfirm}
      />

      {/* Workout progress timeline */}
      <div className="mt-6">
        <WorkoutTimeline
          steps={exerciseSteps}
          currentStepIndex={currentIndex}
          onSelectStepIndex={
            allSetsLogged
              ? (nextIndex) => {
                  setCurrentIndex(nextIndex);
                  initializeDraft(nextIndex);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
};
