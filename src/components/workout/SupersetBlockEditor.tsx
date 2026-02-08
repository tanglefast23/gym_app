'use client';

import { useCallback } from 'react';
import { GripVertical, Trash2, Plus } from 'lucide-react';
import { ExerciseAutocomplete } from './ExerciseAutocomplete';
import { Button } from '@/components/ui/Button';
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

const DEFAULT_REST_BETWEEN_EXERCISES = 30;
const DEFAULT_REST_BETWEEN_SUPERSETS = 90;

/**
 * Editor for a superset block within the workout creator.
 *
 * A superset groups two or more exercises that are performed back-to-back
 * with configurable rest between individual exercises and between rounds.
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const sets = clampInt(e.target.value, 1, VALIDATION.MAX_SETS);
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
    (index: number, raw: string) => {
      const repsMin = clampInt(raw, 1, VALIDATION.MAX_REPS);
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
    (index: number, raw: string) => {
      const repsMax = clampInt(raw, 1, VALIDATION.MAX_REPS);
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
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rest = clampInt(
        e.target.value,
        VALIDATION.MIN_REST_SEC,
        VALIDATION.MAX_REST_SEC,
      );
      onChange({ ...block, restBetweenExercisesSec: rest });
    },
    [block, onChange],
  );

  const handleRestBetweenSupersetsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const rest = clampInt(
        e.target.value,
        VALIDATION.MIN_REST_SEC,
        VALIDATION.MAX_REST_SEC,
      );
      onChange({ ...block, restBetweenSupersetsSec: rest });
    },
    [block, onChange],
  );

  return (
    <div className="rounded-2xl border border-border border-l-indigo-500/20 bg-surface p-4"
      style={{ borderLeftWidth: '4px' }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical className="h-5 w-5 cursor-grab text-text-muted" />
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
      <div className="mb-4 flex flex-col">
        <label className="mb-1 text-xs text-text-muted">
          Sets (all exercises)
        </label>
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
            onRepsMinChange={(raw) => handleRepsMinChange(index, raw)}
            onRepsMaxChange={(raw) => handleRepsMaxChange(index, raw)}
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
      <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
        <div className="flex flex-col">
          <label className="mb-1 text-xs text-text-muted">
            Rest between exercises
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={VALIDATION.MIN_REST_SEC}
              max={VALIDATION.MAX_REST_SEC}
              value={block.restBetweenExercisesSec ?? DEFAULT_REST_BETWEEN_EXERCISES}
              onChange={handleRestBetweenExercisesChange}
              className="w-20 rounded-lg border border-border bg-elevated px-3 py-2 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Rest between exercises in seconds"
            />
            <span className="text-xs text-text-muted">sec</span>
          </div>
        </div>

        <div className="flex flex-col">
          <label className="mb-1 text-xs text-text-muted">
            Rest between rounds
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              inputMode="numeric"
              min={VALIDATION.MIN_REST_SEC}
              max={VALIDATION.MAX_REST_SEC}
              value={block.restBetweenSupersetsSec ?? DEFAULT_REST_BETWEEN_SUPERSETS}
              onChange={handleRestBetweenSupersetsChange}
              className="w-20 rounded-lg border border-border bg-elevated px-3 py-2 text-center text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="Rest between superset rounds in seconds"
            />
            <span className="text-xs text-text-muted">sec</span>
          </div>
        </div>
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
  onRepsMinChange: (raw: string) => void;
  onRepsMaxChange: (raw: string) => void;
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
  onRemove,
}: SupersetExerciseRowProps) => {
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
            className="rounded-lg p-1 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
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
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={VALIDATION.MAX_REPS}
          value={exercise.repsMin}
          onChange={(e) => onRepsMinChange(e.target.value)}
          className="w-14 rounded-lg border border-border bg-elevated px-2 py-1.5 text-center text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label={`Exercise ${index + 1} minimum reps`}
        />
        <span className="text-text-muted">&ndash;</span>
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={VALIDATION.MAX_REPS}
          value={exercise.repsMax}
          onChange={(e) => onRepsMaxChange(e.target.value)}
          className="w-14 rounded-lg border border-border bg-elevated px-2 py-1.5 text-center text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          aria-label={`Exercise ${index + 1} maximum reps`}
        />
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
