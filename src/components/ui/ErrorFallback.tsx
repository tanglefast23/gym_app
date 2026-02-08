'use client';

/**
 * Minimal fallback for less critical sections.
 * Shows muted text with an optional retry callback.
 */
export const ErrorFallback = ({ onRetry }: { onRetry?: () => void }) => {
  return (
    <div className="py-4 text-center text-sm text-text-muted">
      <span>Failed to load</span>
      {onRetry ? (
        <>
          {' \u2014 '}
          <button
            type="button"
            onClick={onRetry}
            className="underline transition-colors hover:text-text-secondary"
          >
            retry
          </button>
        </>
      ) : null}
    </div>
  );
};
