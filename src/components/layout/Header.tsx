'use client';

import { type ReactNode } from 'react';

interface HeaderProps {
  title: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
  /** When true the title is centered between action slots (sub-page pattern). */
  centered?: boolean;
}

/**
 * Sticky page header with title and optional left/right action slots.
 * Includes safe-area padding for notched devices.
 *
 * When `centered` is true, the title is centered between left/right action
 * slots (classic sub-page pattern). Otherwise (default), the title is
 * left-aligned at 28px bold with the action button on the right.
 */
export function Header({
  title,
  leftAction,
  rightAction,
  centered = false,
}: HeaderProps) {
  if (centered) {
    return (
      <header className="sticky top-0 z-30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
        <div className="flex h-[60px] items-center px-5">
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

  return (
    <header className="sticky top-0 z-30 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-lg">
      <div className="flex h-[60px] items-center justify-between px-5">
        {/* Left: title or left action + title */}
        <div className="flex items-center gap-3">
          {leftAction ?? null}
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">
            {title}
          </h1>
        </div>

        {/* Right action slot (typically a 44px circle button) */}
        {rightAction ? (
          <div className="flex items-center">
            {rightAction}
          </div>
        ) : null}
      </div>
    </header>
  );
}
