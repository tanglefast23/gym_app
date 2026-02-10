'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Dumbbell, Layers } from 'lucide-react';
import { AppShell, Header } from '@/components/layout';
import { Button, NumberStepper, ToastContainer, useToastStore } from '@/components/ui';
import { ExerciseBlockEditor } from './ExerciseBlockEditor';
import { SupersetBlockEditor } from './SupersetBlockEditor';
import { db } from '@/lib/db';
import { validateTemplate, sanitizeText } from '@/lib/validation';
import { VALIDATION } from '@/types/workout';
import type { TemplateBlock, ExerciseBlock, SupersetBlock } from '@/types/workout';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Map that tracks display names for exercises by a composite key.
 * For exercise blocks: key = blockId
 * For superset exercises: key = blockId:exerciseIndex
 */
export type ExerciseNameMap = Record<string, string>;

/** Creates a fresh exercise block with sensible defaults. */
function createExerciseBlock(): ExerciseBlock {
  return {
    id: crypto.randomUUID(),
    type: 'exercise',
    exerciseId: '',
    sets: 3,
    repsMin: 8,
    repsMax: 12,
    restBetweenSetsSec: null,
    transitionRestSec: null,
  };
}

/** Creates a fresh superset block with two empty exercises. */
function createSupersetBlock(): SupersetBlock {
  return {
    id: crypto.randomUUID(),
    type: 'superset',
    sets: 3,
    exercises: [
      { exerciseId: '', repsMin: 8, repsMax: 12 },
      { exerciseId: '', repsMin: 8, repsMax: 12 },
    ],
    restBetweenExercisesSec: 30,
    restBetweenSupersetsSec: 90,
    transitionRestSec: null,
  };
}

/**
 * Resolves exercise names to IDs, creating new exercises in the DB
 * when an exerciseId is not a valid UUID (i.e. name-only / new exercise).
 */
async function resolveExerciseIds(
  blocks: TemplateBlock[],
  nameMap: ExerciseNameMap,
): Promise<TemplateBlock[]> {
  const resolvedBlocks: TemplateBlock[] = [];
  const createdCache = new Map<string, string>();

  for (const block of blocks) {
    if (block.type === 'exercise') {
      const resolvedId = await resolveOneExercise(
        block.exerciseId,
        nameMap[block.id] ?? '',
        createdCache,
      );
      resolvedBlocks.push({ ...block, exerciseId: resolvedId });
    } else {
      const resolvedExercises = await Promise.all(
        block.exercises.map(async (ex, idx) => {
          const nameKey = `${block.id}:${idx}`;
          const resolvedId = await resolveOneExercise(
            ex.exerciseId,
            nameMap[nameKey] ?? '',
            createdCache,
          );
          return { ...ex, exerciseId: resolvedId };
        }),
      );
      resolvedBlocks.push({ ...block, exercises: resolvedExercises });
    }
  }

  return resolvedBlocks;
}

/**
 * Resolves a single exercise name/id. If the exerciseId is already a valid
 * DB entry, returns it. Otherwise creates a new exercise and returns the new id.
 */
async function resolveOneExercise(
  exerciseId: string,
  displayName: string,
  cache: Map<string, string>,
): Promise<string> {
  if (!exerciseId && !displayName) return '';

  // If exerciseId looks like a UUID, check if it exists in DB
  if (exerciseId) {
    const existing = await db.exercises.get(exerciseId);
    if (existing) return exerciseId;
  }

  // Try to find by name (case-insensitive)
  const nameToResolve = sanitizeText(displayName || exerciseId);
  if (!nameToResolve) return '';

  // Check cache first (avoid creating duplicates in the same save)
  const cached = cache.get(nameToResolve.toLowerCase());
  if (cached) return cached;

  // Check DB by name
  const byName = await db.exercises
    .where('name')
    .equalsIgnoreCase(nameToResolve)
    .first();
  if (byName) {
    cache.set(nameToResolve.toLowerCase(), byName.id);
    return byName.id;
  }

  // Create new exercise
  const newId = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.exercises.add({
    id: newId,
    name: nameToResolve,
    visualKey: 'default',
    createdAt: now,
    updatedAt: now,
  });
  cache.set(nameToResolve.toLowerCase(), newId);
  return newId;
}

/**
 * Builds the initial nameMap by looking up exercise IDs in the DB.
 * This lets the autocomplete inputs display the correct names on load.
 */
export async function buildNameMapFromBlocks(
  blocks: TemplateBlock[],
): Promise<ExerciseNameMap> {
  const nameMap: ExerciseNameMap = {};
  const exerciseIds = new Set<string>();

  // Collect all exerciseIds
  for (const block of blocks) {
    if (block.type === 'exercise') {
      if (block.exerciseId) exerciseIds.add(block.exerciseId);
    } else {
      for (const ex of block.exercises) {
        if (ex.exerciseId) exerciseIds.add(ex.exerciseId);
      }
    }
  }

  if (exerciseIds.size === 0) {
    return nameMap;
  }

  // Bulk-fetch exercises from DB
  const exercises = await db.exercises
    .where('id')
    .anyOf([...exerciseIds])
    .toArray();
  const idToName = new Map(exercises.map((e) => [e.id, e.name]));

  // Build the map
  for (const block of blocks) {
    if (block.type === 'exercise') {
      const name = idToName.get(block.exerciseId);
      if (name) nameMap[block.id] = name;
    } else {
      for (let idx = 0; idx < block.exercises.length; idx++) {
        const name = idToName.get(block.exercises[idx].exerciseId);
        if (name) nameMap[`${block.id}:${idx}`] = name;
      }
    }
  }

  return nameMap;
}

// --- Component types ---

interface WorkoutEditorProps {
  /** Whether we are creating a new workout or editing an existing one. */
  mode: 'create' | 'edit';
  /** Page header title (e.g. "Create Workout" or "Edit Workout"). */
  title: string;
  /** Initial workout name. Defaults to empty string. */
  initialName?: string;
  /** Initial template blocks. Defaults to empty array. */
  initialBlocks?: TemplateBlock[];
  /** Initial exercise name map (for edit mode, pre-populated from DB). */
  initialNameMap?: ExerciseNameMap;
  /**
   * Async callback invoked when the user saves.
   * Receives resolved blocks, sanitized name, and the nameMap.
   * Should perform the actual DB write and navigation.
   */
  onSave: (data: {
    name: string;
    blocks: TemplateBlock[];
    nameMap: ExerciseNameMap;
    resolvedBlocks: TemplateBlock[];
  }) => Promise<void>;
  /** Label for the save button (e.g. "Save Workout" or "Update Workout"). */
  saveButtonLabel: string;
  /** Icon element for the save button. */
  saveButtonIcon: React.ReactNode;
}

/**
 * Shared workout editor form used by both the Create and Edit pages.
 * Handles all block manipulation, validation, exercise name tracking,
 * and renders the full editor UI.
 */
export function WorkoutEditor({
  title,
  initialName = '',
  initialBlocks = [],
  initialNameMap = {},
  onSave,
  saveButtonLabel,
  saveButtonIcon,
}: WorkoutEditorProps) {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const defaultTransitionsSec = useSettingsStore((s) => s.defaultTransitionsSec);

  const [name, setName] = useState(initialName);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(initialBlocks);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [nameMap, setNameMap] = useState<ExerciseNameMap>(initialNameMap);

  // --- Block manipulation ---

  const addExerciseBlock = useCallback(() => {
    setBlocks((prev) => [...prev, createExerciseBlock()]);
  }, []);

  const addSupersetBlock = useCallback(() => {
    setBlocks((prev) => [...prev, createSupersetBlock()]);
  }, []);

  const updateBlock = useCallback((index: number, updated: TemplateBlock) => {
    setBlocks((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }, []);

  const removeBlock = useCallback((index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // --- Exercise name tracking ---

  const handleExerciseNameChange = useCallback(
    (...args: [string, string, string | null]) => {
      const [blockId, displayName] = args;
      setNameMap((prev) => ({ ...prev, [blockId]: displayName }));
    },
    [],
  );

  const handleSupersetExerciseNameChange = useCallback(
    (...args: [string, number, string, string | null]) => {
      const [blockId, exerciseIndex, displayName] = args;
      const key = `${blockId}:${exerciseIndex}`;
      setNameMap((prev) => ({ ...prev, [key]: displayName }));
    },
    [],
  );

  // --- Save ---

  const handleSave = useCallback(async () => {
    setErrors([]);
    const validationErrors = validateTemplate(name, blocks, nameMap);
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setSaving(true);
    try {
      const resolvedBlocks = await resolveExerciseIds(blocks, nameMap);
      await onSave({
        name: sanitizeText(name),
        blocks,
        nameMap,
        resolvedBlocks,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to save workout';
      addToast(message, 'error');
    } finally {
      setSaving(false);
    }
  }, [name, blocks, nameMap, onSave, addToast]);

  return (
    <AppShell>
      <Header
        title={title}
        centered
        leftAction={
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="px-4 pb-32 pt-4">
        {/* Workout name input */}
        <div className="mb-6">
          <label htmlFor="workout-name" className="mb-1 block text-sm font-medium text-text-secondary">
            Workout Name
          </label>
          <input
            id="workout-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workout name"
            maxLength={VALIDATION.WORKOUT_NAME_MAX}
            className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {/* Block list with timeline rail */}
        <div>
          {blocks.map((block, index) => (
            <div key={block.id} className={index < blocks.length - 1 ? 'pb-4' : ''}>
              {block.type === 'exercise' ? (
                <ExerciseBlockEditor
                  blockNumber={index + 1}
                  block={block}
                  onChange={(updated) => updateBlock(index, updated)}
                  onRemove={() => removeBlock(index)}
                  exerciseName={nameMap[block.id] ?? ''}
                  onExerciseNameChange={handleExerciseNameChange}
                />
              ) : (
                <SupersetBlockEditor
                  blockNumber={index + 1}
                  block={block}
                  onChange={(updated) => updateBlock(index, updated)}
                  onRemove={() => removeBlock(index)}
                  exerciseNames={block.exercises.map(
                    (_, exIdx) => nameMap[`${block.id}:${exIdx}`] ?? '',
                  )}
                  onExerciseNameChange={handleSupersetExerciseNameChange}
                />
              )}

              {/* Transition rest between this block and the next */}
              {index < blocks.length - 1 ? (
                <div className="mt-3 rounded-2xl border border-border bg-surface/60 p-4">
                  <NumberStepper
                    label="Rest between exercises"
                    value={block.transitionRestSec ?? defaultTransitionsSec}
                    onChange={(rest) =>
                      updateBlock(index, { ...block, transitionRestSec: rest })
                    }
                    min={VALIDATION.MIN_REST_SEC}
                    max={VALIDATION.MAX_REST_SEC}
                    step={5}
                    size="sm"
                    suffix="s"
                    ariaLabel="Rest between exercises in seconds"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-xs text-text-muted">
                      {block.transitionRestSec === null
                        ? `Using default transitions (${defaultTransitionsSec}s)`
                        : 'Custom transition rest'}
                    </p>
                    {block.transitionRestSec !== null ? (
                      <button
                        type="button"
                        onClick={() =>
                          updateBlock(index, { ...block, transitionRestSec: null })
                        }
                        className="min-h-[32px] rounded-full border border-border bg-surface px-3 text-xs font-semibold text-text-secondary transition-colors hover:bg-elevated"
                        aria-label="Use default transitions rest time"
                      >
                        Use default
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {/* Add block buttons */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            onClick={addExerciseBlock}
            className="flex-1 border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
          >
            <Dumbbell className="h-4 w-4" />
            Add Exercise
          </Button>
          <Button
            variant="secondary"
            onClick={addSupersetBlock}
            className="flex-1 border-accent/40 bg-accent/10 text-accent hover:bg-accent/20"
          >
            <Layers className="h-4 w-4" />
            Add Superset
          </Button>
        </div>

        {/* Validation errors */}
        {errors.length > 0 && (
          <div className="mt-6 rounded-xl border border-danger/30 bg-danger/10 p-4">
            <p className="mb-2 text-sm font-medium text-danger">
              Please fix the following:
            </p>
            <ul className="list-inside list-disc space-y-1">
              {errors.map((error, i) => (
                <li key={i} className="text-sm text-danger/80">
                  {error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-20 left-0 right-0 z-20 border-t border-border bg-background/80 px-4 py-3 backdrop-blur-lg">
        <Button
          fullWidth
          size="lg"
          onClick={handleSave}
          loading={saving}
          disabled={saving}
        >
          {saveButtonIcon}
          {saveButtonLabel}
        </Button>
      </div>

      <ToastContainer />
    </AppShell>
  );
}
