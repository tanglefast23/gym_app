'use client';

import { type ReactNode } from 'react';

interface HeaderProps {
  title: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

/**
 * Sticky page header with centered title and optional left/right action slots.
 * Includes safe-area padding for notched devices.
 */
export function Header({ title, leftAction, rightAction }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <div className="flex h-14 items-center px-4">
        {/* Left action slot */}
        <div className="flex w-12 justify-start">
          {leftAction ?? null}
        </div>

        {/* Centered title */}
        <h1 className="flex-1 text-center text-lg font-semibold text-text-primary">
          {title}
        </h1>

        {/* Right action slot */}
        <div className="flex w-12 justify-end">
          {rightAction ?? null}
        </div>
      </div>
    </header>
  );
}
