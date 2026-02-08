'use client';

import { type ReactNode } from 'react';

interface EmptyStateProps {
  illustrationSrc?: string;
  illustrationAlt?: string;
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export const EmptyState = ({
  illustrationSrc,
  illustrationAlt,
  icon,
  title,
  description,
  action,
}: EmptyStateProps) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-[280px] mx-auto gap-4">
      {illustrationSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={illustrationSrc}
          alt={illustrationAlt ?? ''}
          className="w-[260px] max-w-full select-none"
          draggable={false}
        />
      ) : null}

      {!illustrationSrc && icon ? (
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
