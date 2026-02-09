'use client';

import { useState } from 'react';
import { BottomSheet, Stepper } from '@/components/ui';
import { displayToGrams, gramsToKg, gramsToLb } from '@/lib/calculations';

/** Big step for the weight stepper (always 5 in display units). */
const WEIGHT_BIG_STEP = 5;

interface SetLogSheetProps {
  isOpen: boolean;
  onSaveAndRest: (weightG: number, repsDone: number) => void;
  onSkip: () => void;
  exerciseName: string;
  setNumber: number;
  totalSets: number;
  prefillWeightG: number;
  prefillReps: number;
  unitSystem: 'kg' | 'lb';
  weightStep: number;
}

interface SetLogFormProps {
  onSaveAndRest: (weightG: number, repsDone: number) => void;
  onSkip: () => void;
  prefillWeightG: number;
  prefillReps: number;
  unitSystem: 'kg' | 'lb';
  weightStep: number;
}

/**
 * Inner form that holds draft weight/reps state.
 * Remounted each time the sheet opens so state resets to prefill values.
 */
const SetLogForm = ({
  onSaveAndRest,
  onSkip,
  prefillWeightG,
  prefillReps,
  unitSystem,
  weightStep,
}: SetLogFormProps) => {
  const prefillDisplay =
    unitSystem === 'kg' ? gramsToKg(prefillWeightG) : gramsToLb(prefillWeightG);

  const [draftWeightDisplay, setDraftWeightDisplay] = useState(prefillDisplay);
  const [draftReps, setDraftReps] = useState(prefillReps);

  const formatWeight = (v: number) =>
    unitSystem === 'kg' ? v.toFixed(1) : v.toFixed(0);

  return (
    <div className="flex flex-col gap-6">
      {/* Weight stepper */}
      <Stepper
        value={draftWeightDisplay}
        onChange={setDraftWeightDisplay}
        step={weightStep}
        bigStep={WEIGHT_BIG_STEP}
        min={0}
        max={unitSystem === 'kg' ? 999 : 2204}
        label={`Weight (${unitSystem})`}
        formatValue={formatWeight}
      />

      {/* Reps stepper */}
      <Stepper
        value={draftReps}
        onChange={setDraftReps}
        step={1}
        min={0}
        max={99}
        label="Reps"
      />

      {/* Action buttons */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-xl border border-border bg-surface py-3.5 text-sm font-semibold text-text-secondary transition-colors active:scale-[0.97]"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => onSaveAndRest(displayToGrams(draftWeightDisplay, unitSystem), draftReps)}
          className="flex-1 rounded-xl bg-accent py-3.5 text-sm font-bold text-black transition-colors active:scale-[0.97]"
        >
          Save & Rest
        </button>
      </div>
    </div>
  );
};

export const SetLogSheet = ({
  isOpen,
  onSaveAndRest,
  onSkip,
  exerciseName,
  setNumber,
  totalSets,
  prefillWeightG,
  prefillReps,
  unitSystem,
  weightStep,
}: SetLogSheetProps) => {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onSkip}
      title={`${exerciseName} — Set ${setNumber}/${totalSets}`}
    >
      {/* Conditional render forces remount when sheet opens, resetting draft state */}
      {isOpen ? (
        <SetLogForm
          onSaveAndRest={onSaveAndRest}
          onSkip={onSkip}
          prefillWeightG={prefillWeightG}
          prefillReps={prefillReps}
          unitSystem={unitSystem}
          weightStep={weightStep}
        />
      ) : null}
    </BottomSheet>
  );
};
