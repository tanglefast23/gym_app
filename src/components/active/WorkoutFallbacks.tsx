'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

// -----------------------------------------------------------------------------
// Loading spinner shown while the template is being fetched from Dexie
// -----------------------------------------------------------------------------

export function LoadingSpinner(): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
    </div>
  );
}

// -----------------------------------------------------------------------------
// 404-style screen when the template can't be found
// -----------------------------------------------------------------------------

export function NotFoundScreen({
  onBack,
}: {
  onBack: () => void;
}): React.JSX.Element {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-6 text-center">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">
          Workout not found
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          This workout template may have been deleted.
        </p>
        <div className="mt-6 flex justify-center">
          <Button variant="primary" onClick={onBack}>
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
