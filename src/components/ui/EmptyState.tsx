'use client';

import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-text-muted">
      {icon ? (
        <div className="mb-4 text-text-muted">{icon}</div>
      ) : null}

      <h3 className="text-lg font-medium text-text-secondary">{title}</h3>

      {description ? (
        <p className="mt-2 max-w-xs text-center text-sm text-text-muted">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
};
