'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { getLastPerformedSetsForMultiple } from '@/lib/queries';
import { displayToGrams } from '@/lib/calculations';
import type { WorkoutStep, ExerciseStep, PerformedSet } from '@/types/workout';

/* ── Types ─────────────────────────────────────────────────────────── */

export type DraftWeightSource =
  | 'existing'
  | 'previous'
  | 'history'
  | 'default'
  | 'user';

export interface DraftWeight {
  weightG: number;
  source: DraftWeightSource;
}

export interface UseWeightPrefillReturn {
  draftWeight: DraftWeight;
  setDraftWeight: (draft: DraftWeight) => void;
  draftReps: number;
  setDraftReps: (reps: number) => void;
  historicalSetsRef: React.RefObject<Map<string, PerformedSet[]>>;
  historicalLoaded: boolean;
  initializeDraft: (index: number) => void;
}

/* ── Pure helpers ──────────────────────────────────────────────────── */

/**
 * Find the next exercise step that hasn't been logged yet, starting from `from`.
 */
export function findNextUnfilledIndex(
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

/**
 * Search backward through performed sets for the most recent weight
 * logged for a given exercise before `beforeIndex`.
 */
export function findPreviousSetWeight(
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

/**
 * Look up weight from the last completed session for this exercise + set index.
 */
export function findHistoricalWeight(
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

/* ── Hook ──────────────────────────────────────────────────────────── */

/**
 * Manages draft weight/reps state and historical weight prefill logic.
 *
 * Responsibilities:
 * - Fetches historical sets for all exercises (batch query, runs once)
 * - Provides `initializeDraft` to prefill weight/reps when navigating sets
 * - Exposes `findPreviousSetWeight` / `findHistoricalWeight` / `findNextUnfilledIndex`
 *   as importable helpers for use in callbacks
 */
export function useWeightPrefill(
  exerciseSteps: ExerciseStep[],
  performedSets: Array<PerformedSet | null>,
): UseWeightPrefillReturn {
  const unitSystem = useSettingsStore((s) => s.unitSystem);

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
      try {
        const result = await getLastPerformedSetsForMultiple([...exerciseIds]);

        if (!cancelled) {
          historicalSetsRef.current = result;
          setHistoricalLoaded(true);
        }
      } catch (error: unknown) {
        console.warn('[useWeightPrefill] Failed to fetch exercise history:', error);
        if (!cancelled) setHistoricalLoaded(true);
      }
    };

    void fetchHistory();

    return () => { cancelled = true; };
  }, [exerciseSteps]);

  // Draft weight state
  const [draftWeight, setDraftWeight] = useState<DraftWeight>(() => {
    const step = exerciseSteps[0];
    const existing = performedSets[0];
    if (existing) return { weightG: existing.weightG, source: 'existing' };
    const prevWeight = step?.exerciseId
      ? findPreviousSetWeight(performedSets, step.exerciseId, 0)
      : null;
    if (prevWeight !== null) return { weightG: prevWeight, source: 'previous' };
    return { weightG: firstWeightDefaultG, source: 'default' };
  });

  // Draft reps state
  const [draftReps, setDraftReps] = useState<number>(() => {
    const existing = performedSets[0];
    if (existing) return existing.repsDone;
    const step = exerciseSteps[0];
    return step?.repsMax ?? 0;
  });

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
      setDraftReps(step.repsMax);

      // Prefill weight: in-session first, then historical, then default.
      const prevWeight = step.exerciseId
        ? findPreviousSetWeight(performedSets, step.exerciseId, index)
        : null;
      if (prevWeight !== null) {
        setDraftWeight({ weightG: prevWeight, source: 'previous' });
      } else {
        const histWeight = step.exerciseId
          ? findHistoricalWeight(
              historicalSetsRef.current,
              step.exerciseId,
              step.setIndex,
            )
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

  return {
    draftWeight,
    setDraftWeight,
    draftReps,
    setDraftReps,
    historicalSetsRef,
    historicalLoaded,
    initializeDraft,
  };
}
