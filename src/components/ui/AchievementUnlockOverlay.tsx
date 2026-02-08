'use client';

import { useEffect } from 'react';
import type { NewAchievementInfo } from '@/components/active';

interface AchievementUnlockOverlayProps {
  achievement: NewAchievementInfo;
  onDismiss: () => void;
}

/**
 * Brief achievement celebration overlay.
 *
 * Intent: make unlocks feel "earned" without forcing extra taps.
 * Auto-dismisses after ~2 seconds; tap anywhere to dismiss early.
 */
export function AchievementUnlockOverlay({
  achievement,
  onDismiss,
}: AchievementUnlockOverlayProps): React.JSX.Element {
  useEffect(() => {
    const id = setTimeout(onDismiss, 2000);
    return () => clearTimeout(id);
  }, [achievement.id, onDismiss]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-6"
      role="status"
      aria-live="polite"
      onClick={onDismiss}
    >
      <div className="absolute inset-0 bg-black/55" />

      <div
        className={[
          'relative w-full max-w-sm overflow-hidden rounded-3xl',
          'border border-warning/30 bg-elevated shadow-2xl',
          'p-6',
          'animate-scale-in',
        ].join(' ')}
      >
        {/* Shimmer */}
        <div className="pointer-events-none absolute inset-0 opacity-40 animate-shimmer" />

        <div className="relative flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-warning/10">
            <div className="absolute inset-0 rounded-2xl ring-1 ring-warning/30 shadow-[0_0_32px_rgba(245,158,11,0.25)]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={achievement.iconSrc}
              alt=""
              className="relative h-12 w-12 select-none"
              draggable={false}
            />
          </div>

          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[1px] text-warning">
              Achievement unlocked
            </p>
            <p className="mt-1 truncate text-lg font-bold text-text-primary">
              {achievement.name}
            </p>
            {achievement.context ? (
              <p className="mt-1 truncate text-sm text-text-secondary">
                {achievement.context}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

