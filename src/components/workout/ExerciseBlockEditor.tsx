'use client';

import { useCallback, useState, useEffect } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { ExerciseAutocomplete } from './ExerciseAutocomplete';
import { NumberStepper } from '@/components/ui';
import { VALIDATION } from '@/types/workout';
import type { ExerciseBlock } from '@/types/workout';

interface ExerciseBlockEditorProps {
  block: ExerciseBlock;
  onChange: (updated: ExerciseBlock) => void;
  onRemove: () => void;
  /** Display name for the exercise (tracked by the parent page). */
  exerciseName?: string;
  /** Called when user changes the exercise name text (parent tracks the mapping). */
  onExerciseNameChange?: (blockId: string, name: string, exerciseId: string | null) => void;
}

/**
 * Editor for a single exercise block within the workout creator.
 *
 * Uses mobile-friendly NumberStepper components for sets and reps
 * instead of native number inputs.
 */
export const ExerciseBlockEditor = ({
  block,
  onChange,
  onRemove,
  exerciseName = '',
  onExerciseNameChange,
}: ExerciseBlockEditorProps) => {
  const [localName, setLocalName] = useState(exerciseName);

  // Sync when external prop changes (e.g. loading from DB)
  useEffect(() => {
    setLocalName(exerciseName);
  }, [exerciseName]);

  const handleExerciseChange = useCallback(
    (name: string, exerciseId: string | null) => {
      setLocalName(name);
      onChange({
        ...block,
        exerciseId: exerciseId ?? '',
      });
      onExerciseNameChange?.(block.id, name, exerciseId);
    },
    [block, onChange, onExerciseNameChange],
  );

  const handleSetsChange = useCallback(
    (sets: number) => {
      onChange({ ...block, sets });
    },
    [block, onChange],
  );

  const handleRepsMinChange = useCallback(
    (repsMin: number) => {
      onChange({
        ...block,
        repsMin,
        repsMax: Math.max(repsMin, block.repsMax),
      });
    },
    [block, onChange],
  );

  const handleRepsMaxChange = useCallback(
    (repsMax: number) => {
      onChange({
        ...block,
        repsMax,
        repsMin: Math.min(block.repsMin, repsMax),
      });
    },
    [block, onChange],
  );

  const handleRestToggle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({
        ...block,
        restBetweenSetsSec: e.target.checked ? 90 : null,
      });
    },
    [block, onChange],
  );

  const handleRestChange = useCallback(
    (rest: number) => {
      onChange({ ...block, restBetweenSetsSec: rest });
    },
    [block, onChange],
  );

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 cursor-grab text-text-muted" />
          <span className="text-sm font-medium text-text-secondary">
            Exercise
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Remove exercise block"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Exercise name */}
      <div className="mb-4">
        <ExerciseAutocomplete
          value={localName}
          onChange={handleExerciseChange}
          placeholder="Search exercise..."
        />
      </div>

      {/* Sets & Reps — mobile-friendly steppers */}
      <div className="flex flex-wrap items-end gap-4">
        <NumberStepper
          label="Sets"
          value={block.sets}
          onChange={handleSetsChange}
          min={1}
          max={VALIDATION.MAX_SETS}
          step={1}
        />

        <div className="flex flex-col">
          <label className="mb-1 text-xs font-medium text-text-muted">Reps</label>
          <div className="flex items-center gap-1">
            <NumberStepper
              value={block.repsMin}
              onChange={handleRepsMinChange}
              min={1}
              max={VALIDATION.MAX_REPS}
              step={1}
              ariaLabel="Minimum reps"
            />
            <span className="px-1 text-text-muted">&ndash;</span>
            <NumberStepper
              value={block.repsMax}
              onChange={handleRepsMaxChange}
              min={1}
              max={VALIDATION.MAX_REPS}
              step={1}
              ariaLabel="Maximum reps"
            />
          </div>
        </div>
      </div>

      {/* Rest override */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={block.restBetweenSetsSec !== null}
            onChange={handleRestToggle}
            className="h-5 w-5 rounded border-border accent-accent"
          />
          Rest override
        </label>

        {block.restBetweenSetsSec !== null && (
          <NumberStepper
            value={block.restBetweenSetsSec}
            onChange={handleRestChange}
            min={VALIDATION.MIN_REST_SEC}
            max={VALIDATION.MAX_REST_SEC}
            step={5}
            suffix="s"
            ariaLabel="Rest between sets in seconds"
          />
        )}
      </div>
    </div>
  );
};
