'use client';

import { useCallback, useState, useEffect } from 'react';
import { GripVertical, Trash2 } from 'lucide-react';
import { ExerciseAutocomplete } from './ExerciseAutocomplete';
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
 * Renders the exercise name autocomplete, sets count, rep range inputs,
 * and an optional rest-time override.
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const sets = clampInt(e.target.value, 1, VALIDATION.MAX_SETS);
      onChange({ ...block, sets });
    },
    [block, onChange],
  );

  const handleRepsMinChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const repsMin = clampInt(e.target.value, 1, VALIDATION.MAX_REPS);
      onChange({
        ...block,
        repsMin,
        repsMax: Math.max(repsMin, block.repsMax),
      });
    },
    [block, onChange],
  );

  const handleRepsMaxChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const repsMax = clampInt(e.target.value, 1, VALIDATION.MAX_REPS);
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rest = clampInt(
        e.target.value,
        VALIDATION.MIN_REST_SEC,
        VALIDATION.MAX_REST_SEC,
      );
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

      {/* Sets & Reps */}
      <div className="flex items-end gap-3">
        {/* Sets */}
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-text-muted">Sets</label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={VALIDATION.MAX_SETS}
            value={block.sets}
            onChange={handleSetsChange}
            className="w-16 rounded-lg border border-border bg-elevated px-3 py-2 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Reps range */}
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-text-muted">Reps</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={VALIDATION.MAX_REPS}
              value={block.repsMin}
              onChange={handleRepsMinChange}
              className="w-16 rounded-lg border border-border bg-elevated px-3 py-2 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Minimum reps"
            />
            <span className="text-text-muted">&ndash;</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={VALIDATION.MAX_REPS}
              value={block.repsMax}
              onChange={handleRepsMaxChange}
              className="w-16 rounded-lg border border-border bg-elevated px-3 py-2 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Maximum reps"
            />
          </div>
        </div>
      </div>

      {/* Rest override */}
      <div className="mt-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={block.restBetweenSetsSec !== null}
            onChange={handleRestToggle}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          Rest override
        </label>

        {block.restBetweenSetsSec !== null && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={VALIDATION.MIN_REST_SEC}
              max={VALIDATION.MAX_REST_SEC}
              value={block.restBetweenSetsSec}
              onChange={handleRestChange}
              className="w-20 rounded-lg border border-border bg-elevated px-3 py-2 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Rest between sets in seconds"
            />
            <span className="text-xs text-text-muted">sec</span>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a string as an integer clamped to [min, max]. */
function clampInt(raw: string, min: number, max: number): number {
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}
