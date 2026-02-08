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
    <div className="flex flex-col items-center justify-center p-6 max-w-[280px] mx-auto gap-4">
      {icon ? (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-elevated text-text-muted">
          {icon}
        </div>
      ) : null}

      <h3 className="text-lg font-semibold text-text-secondary">{title}</h3>

      {description ? (
        <p className="max-w-[240px] text-center text-sm text-text-muted">
          {description}
        </p>
      ) : null}

      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
};
