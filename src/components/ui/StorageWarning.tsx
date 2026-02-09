'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useStorageQuota } from '@/hooks';

/**
 * Dismissible amber warning banner that appears when device storage
 * usage exceeds 80% of quota. Renders nothing when storage is healthy.
 * Reappears on next mount after dismissal.
 */
export function StorageWarning(): React.ReactNode {
  const { isLow, percentUsed } = useStorageQuota();
  const [dismissed, setDismissed] = useState(false);

  if (!isLow || dismissed) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-warning/30 bg-elevated px-4 py-3"
    >
      <p className="flex-1 text-sm text-warning">
        Storage is running low ({percentUsed}% used). Consider exporting your
        data and clearing old workouts.
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-warning/70 transition-colors hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Dismiss storage warning"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
