'use client';

import { Check, CopyCheck, Copy } from 'lucide-react';
import { Stepper } from '@/components/ui';
import {
  formatWeightValue,
  displayToGrams,
} from '@/lib/calculations';
import type { UnitSystem } from '@/types/workout';

/* ── Types ─────────────────────────────────────────────────────────── */

interface RecapSetCardProps {
  /** Display name for the current exercise. */
  exerciseName: string;
  /** 1-based current set number within this exercise. */
  currentSetNumber: number;
  /** Total sets for this exercise. */
  totalExerciseSets: number;
  /** Weight in display units (kg or lb). */
  weightDisplay: number;
  /** Weight step size in display units. */
  weightStep: number;
  /** Big weight step size in display units (for double buttons). */
  weightBigStep: number;
  /** Unit system for weight display. */
  unitSystem: UnitSystem;
  /** Called when weight changes (value in display units). */
  onWeightChange: (displayValue: number) => void;
  /** Current draft reps. */
  draftReps: number;
  /** Called when reps change. */
  onRepsChange: (reps: number) => void;
  /** Whether the final review mode is active (hides quick actions). */
  isFinalReview: boolean;
  /** Whether there's a previous set weight to copy from. */
  hasPreviousSetWeight: boolean;
  /** Called when "Same weight" is clicked. */
  onApplySameWeight: () => void;
  /** Visual feedback for "Same weight" button. */
  sameWeightFeedback: boolean;
  /** Whether there are remaining unfilled sets for this exercise. */
  hasRemainingSetsForExercise: boolean;
  /** Whether this is the final set in the entire workout. */
  isFinalSet: boolean;
  /** Called when "Apply to remaining" is clicked. */
  onApplyToRemaining: () => void;
  /** Visual feedback for "Apply to remaining" button. */
  applyFeedback: boolean;
}

/* ── Component ─────────────────────────────────────────────────────── */

export const RecapSetCard = ({
  exerciseName,
  currentSetNumber,
  totalExerciseSets,
  weightDisplay,
  weightStep,
  weightBigStep,
  unitSystem,
  onWeightChange,
  draftReps,
  onRepsChange,
  isFinalReview,
  hasPreviousSetWeight,
  onApplySameWeight,
  sameWeightFeedback,
  hasRemainingSetsForExercise,
  isFinalSet,
  onApplyToRemaining,
  applyFeedback,
}: RecapSetCardProps) => {
  return (
    <div className="mt-6 flex-1">
      <div className="rounded-2xl bg-surface p-6">
        {/* Exercise name */}
        <h3 className="text-center text-lg font-semibold text-text-primary">
          {exerciseName}
        </h3>

        {/* Set indicator */}
        <p className="mt-1 text-center text-sm text-text-secondary">
          Set {currentSetNumber} of {totalExerciseSets}
        </p>

        {/* Weight stepper */}
        <div className="mt-6">
          <Stepper
            value={weightDisplay}
            onChange={onWeightChange}
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
            onChange={onRepsChange}
            step={1}
            min={0}
            max={999}
            label="Reps"
          />
        </div>

        {/* Quick action buttons */}
        {!isFinalReview ? (
          <div className="mt-4 flex gap-3">
            {/* Same weight button */}
            <button
              type="button"
              onClick={onApplySameWeight}
              disabled={!hasPreviousSetWeight}
              aria-label="Copy weight from previous set"
              className={[
                'flex flex-1 items-center justify-center gap-2',
                'rounded-xl px-3 py-2.5',
                'text-sm font-medium',
                'transition-all duration-200',
                sameWeightFeedback
                  ? 'bg-success/20 text-success border border-success/40'
                  : 'bg-elevated text-text-secondary border border-border',
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
            {hasRemainingSetsForExercise && !isFinalSet ? (
              <button
                type="button"
                onClick={onApplyToRemaining}
                disabled={applyFeedback}
                aria-label="Apply current weight to all remaining sets of this exercise"
                className={[
                  'flex flex-1 items-center justify-center gap-2',
                  'rounded-xl px-3 py-2.5',
                  'text-sm font-medium',
                  'transition-all duration-200',
                  applyFeedback
                    ? 'bg-success/20 text-success border border-success/40'
                    : 'bg-elevated text-text-secondary border border-border hover:bg-surface active:scale-[0.97]',
                ].join(' ')}
              >
                {applyFeedback ? (
                  <Check className="h-4 w-4 animate-check-pop" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {applyFeedback ? 'Applied!' : 'Apply to remaining'}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
