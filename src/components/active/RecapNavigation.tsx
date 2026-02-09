'use client';

import { ChevronLeft, ChevronRight, Check, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog } from '@/components/ui';

/* ── Types ─────────────────────────────────────────────────────────── */

interface RecapNavigationProps {
  /** Index of the current set (0-based). */
  currentIndex: number;
  /** Total number of exercise sets. */
  totalSets: number;
  /** Whether all sets have been logged. */
  allSetsLogged: boolean;
  /** Whether the final review mode is active. */
  isFinalReview: boolean;
  /** Whether this is the final set. */
  isFinalSet: boolean;
  /** Whether the save operation is in progress. */
  isSaving: boolean;
  /** Whether save-nudge animation should play. */
  saveNudge: boolean;
  /** Whether the partial-save feedback is showing. */
  savingPartial: boolean;
  /** Called to navigate to the previous set. */
  onPrevious: () => void;
  /** Called to navigate to the next set. */
  onNext: () => void;
  /** Called to complete and save the workout. */
  onComplete: () => void;
  /** Called to save a partial workout. */
  onSavePartial: () => void;
  /** Called to discard the workout (undefined if not available). */
  onDiscard?: () => void;
  /** Whether the discard confirmation dialog is open. */
  showDiscardConfirm: boolean;
  /** Called to open/close the discard confirmation dialog. */
  onSetShowDiscardConfirm: (show: boolean) => void;
}

/* ── Component ─────────────────────────────────────────────────────── */

export const RecapNavigation = ({
  currentIndex,
  totalSets,
  allSetsLogged,
  isFinalReview,
  isFinalSet,
  isSaving,
  saveNudge,
  savingPartial,
  onPrevious,
  onNext,
  onComplete,
  onSavePartial,
  onDiscard,
  showDiscardConfirm,
  onSetShowDiscardConfirm,
}: RecapNavigationProps) => {
  return (
    <>
      {/* Primary navigation */}
      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="secondary"
          size="lg"
          onClick={onPrevious}
          disabled={currentIndex === 0}
          className="flex-1"
        >
          <ChevronLeft className="h-5 w-5" />
          Previous
        </Button>

        {!allSetsLogged && currentIndex < totalSets - 1 ? (
          <Button
            variant="primary"
            size="lg"
            onClick={onNext}
            className="flex-1"
          >
            Next
            <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            onClick={onComplete}
            loading={isSaving}
            disabled={isSaving}
            className={['flex-1', saveNudge ? 'animate-pulse-glow' : ''].join(' ')}
          >
            Save Workout
          </Button>
        )}
      </div>

      {/* Secondary actions (partial save, discard) */}
      {!isFinalReview ? (
        <div className="mt-4 flex flex-col gap-2">
          {allSetsLogged && !isFinalSet ? (
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onClick={onComplete}
              loading={isSaving}
              disabled={isSaving}
              className={saveNudge ? 'animate-pulse-glow' : ''}
            >
              Save Workout
            </Button>
          ) : null}

          <button
            type="button"
            disabled={savingPartial}
            onClick={onSavePartial}
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
              onClick={() => onSetShowDiscardConfirm(true)}
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
      ) : null}

      {/* Discard confirmation dialog */}
      <ConfirmDialog
        isOpen={showDiscardConfirm}
        onClose={() => onSetShowDiscardConfirm(false)}
        onConfirm={() => {
          onSetShowDiscardConfirm(false);
          onDiscard?.();
        }}
        title="Discard workout?"
        description="This will delete the entire workout session. No data will be saved."
        confirmText="Discard"
        variant="danger"
      />
    </>
  );
};
