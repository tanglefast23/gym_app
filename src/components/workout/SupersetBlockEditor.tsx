'use client';

import { useCallback, useRef } from 'react';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { ExerciseAutocomplete } from './ExerciseAutocomplete';
import { Button, NumberStepper, AMRAP_SENTINEL } from '@/components/ui';
import { VALIDATION } from '@/types/workout';
import type { SupersetBlock, ExerciseBlockExercise } from '@/types/workout';

interface SupersetBlockEditorProps {
  block: SupersetBlock;
  onChange: (updated: SupersetBlock) => void;
  onRemove: () => void;
  /** Array of display names for exercises in this superset (parallel to block.exercises). */
  exerciseNames?: string[];
  /** Called when user changes an exercise name inside the superset. */
  onExerciseNameChange?: (
    blockId: string,
    exerciseIndex: number,
    name: string,
    exerciseId: string | null,
  ) => void;
}

/**
 * Editor for a superset block within the workout creator.
 *
 * Uses mobile-friendly NumberStepper components for all numeric inputs.
 */
export const SupersetBlockEditor = ({
  block,
  onChange,
  onRemove,
  exerciseNames = [],
  onExerciseNameChange,
}: SupersetBlockEditorProps) => {
  // --- Shared sets --------------------------------------------------------

  const handleSetsChange = useCallback(
    (sets: number) => {
      onChange({ ...block, sets });
    },
    [block, onChange],
  );

  // --- Per-exercise handlers ----------------------------------------------

  const handleExerciseNameChange = useCallback(
    (index: number, name: string, exerciseId: string | null) => {
      const updated = [...block.exercises];
      updated[index] = {
        ...updated[index],
        exerciseId: exerciseId ?? '',
      };
      onChange({ ...block, exercises: updated });
      onExerciseNameChange?.(block.id, index, name, exerciseId);
    },
    [block, onChange, onExerciseNameChange],
  );

  const handleRepsMinChange = useCallback(
    (index: number, repsMin: number) => {
      const updated = [...block.exercises];
      updated[index] = {
        ...updated[index],
        repsMin,
        repsMax: Math.max(repsMin, updated[index].repsMax),
      };
      onChange({ ...block, exercises: updated });
    },
    [block, onChange],
  );

  const handleRepsMaxChange = useCallback(
    (index: number, repsMax: number) => {
      const updated = [...block.exercises];
      updated[index] = {
        ...updated[index],
        repsMax,
        repsMin: Math.min(updated[index].repsMin, repsMax),
      };
      onChange({ ...block, exercises: updated });
    },
    [block, onChange],
  );

  const handleAmrapToggle = useCallback(
    (index: number, lastNumericMax: number) => {
      const updated = [...block.exercises];
      const isAmrap = updated[index].repsMax === AMRAP_SENTINEL;
      updated[index] = {
        ...updated[index],
        repsMax: isAmrap ? lastNumericMax : AMRAP_SENTINEL,
      };
      onChange({ ...block, exercises: updated });
    },
    [block, onChange],
  );

  const handleRemoveExercise = useCallback(
    (index: number) => {
      if (block.exercises.length <= 2) return;
      const updated = block.exercises.filter((_, i) => i !== index);
      onChange({ ...block, exercises: updated });
    },
    [block, onChange],
  );

  const handleAddExercise = useCallback(() => {
    const newExercise: ExerciseBlockExercise = {
      exerciseId: '',
      repsMin: 8,
      repsMax: 12,
    };
    onChange({ ...block, exercises: [...block.exercises, newExercise] });
  }, [block, onChange]);

  // --- Rest handlers ------------------------------------------------------

  const handleRestBetweenExercisesChange = useCallback(
    (rest: number) => {
      onChange({ ...block, restBetweenExercisesSec: rest });
    },
    [block, onChange],
  );

  const handleRestBetweenSupersetsChange = useCallback(
    (rest: number) => {
      onChange({ ...block, restBetweenSupersetsSec: rest });
    },
    [block, onChange],
  );

  return (
    <div className="rounded-2xl border border-border border-l-[4px] border-l-accent/50 bg-surface p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 text-text-muted" aria-hidden="true" />
          <span className="rounded-full bg-accent/20 px-2 py-1 text-xs font-medium text-accent">
            Superset
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Remove superset block"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Shared sets */}
      <div className="mb-4">
        <NumberStepper
          label="Sets (all exercises)"
          value={block.sets}
          onChange={handleSetsChange}
          min={1}
          max={VALIDATION.MAX_SETS}
          step={1}
        />
      </div>

      {/* Exercise list */}
      <div className="space-y-3">
        {block.exercises.map((exercise, index) => (
          <SupersetExerciseRow
            key={`${block.id}-ex-${index}`}
            exercise={exercise}
            index={index}
            canRemove={block.exercises.length > 2}
            exerciseName={exerciseNames[index] ?? ''}
            onNameChange={(name, exerciseId) =>
              handleExerciseNameChange(index, name, exerciseId)
            }
            onRepsMinChange={(val) => handleRepsMinChange(index, val)}
            onRepsMaxChange={(val) => handleRepsMaxChange(index, val)}
            onAmrapToggle={(lastMax) => handleAmrapToggle(index, lastMax)}
            onRemove={() => handleRemoveExercise(index)}
          />
        ))}
      </div>

      {/* Add exercise */}
      <div className="mt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddExercise}
        >
          <Plus className="h-4 w-4" />
          Add Exercise
        </Button>
      </div>

      {/* Rest settings */}
      <div className="mt-4 flex flex-col items-center gap-4 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
        <NumberStepper
          label="Rest between exercises"
          value={block.restBetweenExercisesSec}
          onChange={handleRestBetweenExercisesChange}
          min={VALIDATION.MIN_REST_SEC}
          max={VALIDATION.MAX_REST_SEC}
          step={5}
          suffix="s"
          ariaLabel="Rest between exercises in seconds"
        />

        <NumberStepper
          label="Rest between rounds"
          value={block.restBetweenSupersetsSec}
          onChange={handleRestBetweenSupersetsChange}
          min={VALIDATION.MIN_REST_SEC}
          max={VALIDATION.MAX_REST_SEC}
          step={5}
          suffix="s"
          ariaLabel="Rest between superset rounds in seconds"
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-component: a single exercise row within the superset
// ---------------------------------------------------------------------------

interface SupersetExerciseRowProps {
  exercise: ExerciseBlockExercise;
  index: number;
  canRemove: boolean;
  exerciseName: string;
  onNameChange: (name: string, exerciseId: string | null) => void;
  onRepsMinChange: (value: number) => void;
  onRepsMaxChange: (value: number) => void;
  onAmrapToggle: (lastNumericMax: number) => void;
  onRemove: () => void;
}

const SupersetExerciseRow = ({
  exercise,
  index,
  canRemove,
  exerciseName,
  onNameChange,
  onRepsMinChange,
  onRepsMaxChange,
  onAmrapToggle,
  onRemove,
}: SupersetExerciseRowProps) => {
  const lastNumericMaxRef = useRef(exercise.repsMax || 12);
  const isAmrap = exercise.repsMax === AMRAP_SENTINEL;

  const handleMaxChange = useCallback(
    (val: number) => {
      lastNumericMaxRef.current = val;
      onRepsMaxChange(val);
    },
    [onRepsMaxChange],
  );

  const handleAmrap = useCallback(() => {
    if (!isAmrap) {
      lastNumericMaxRef.current = exercise.repsMax;
    }
    onAmrapToggle(lastNumericMaxRef.current);
  }, [exercise.repsMax, isAmrap, onAmrapToggle]);

  return (
    <div className="rounded-xl border border-border bg-elevated/50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted">
          Exercise {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="flex h-[44px] w-[44px] items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
            aria-label={`Remove exercise ${index + 1}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <ExerciseAutocomplete
        value={exerciseName}
        onChange={onNameChange}
        placeholder="Search exercise..."
      />

      <div className="mt-2 flex items-center gap-1">
        <label className="mr-1 text-xs text-text-muted">Reps</label>
        <NumberStepper
          value={exercise.repsMin}
          onChange={onRepsMinChange}
          min={1}
          max={VALIDATION.MAX_REPS}
          step={1}
          size="sm"
          ariaLabel={`Exercise ${index + 1} minimum reps`}
        />
        <span className="px-1 text-text-muted">&ndash;</span>
        <NumberStepper
          value={exercise.repsMax}
          onChange={handleMaxChange}
          min={1}
          max={VALIDATION.MAX_REPS}
          step={1}
          size="sm"
          amrap={isAmrap}
          onAmrapToggle={handleAmrap}
          ariaLabel={`Exercise ${index + 1} maximum reps`}
        />
      </div>
    </div>
  );
};
