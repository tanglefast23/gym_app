'use client';

import { type ReactNode } from 'react';

type CardPadding = 'sm' | 'md' | 'lg';

interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: CardPadding;
}

const paddingClasses: Record<CardPadding, string> = {
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

export const Card = ({
  children,
  className = '',
  onClick,
  padding = 'md',
}: CardProps) => {
  const classes = [
    'bg-surface rounded-2xl border border-border',
    paddingClasses[padding],
    onClick ? 'cursor-pointer active:scale-[0.97] transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={classes}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
};
