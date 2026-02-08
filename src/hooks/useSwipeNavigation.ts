'use client';

import { useRef, useCallback, type RefObject } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { tabs } from '@/components/layout/BottomTabBar';

const SWIPE_THRESHOLD = 50;
const SWIPE_MAX_VERTICAL = 100;

/**
 * Returns the index of the currently active tab based on pathname.
 * Uses the same matching logic as the BottomTabBar.
 */
function getActiveTabIndex(pathname: string): number {
  // Check non-root tabs first (prefix match), then fall back to root
  for (let i = tabs.length - 1; i >= 1; i--) {
    if (pathname.startsWith(tabs[i].href)) {
      return i;
    }
  }
  // Root tab uses exact match
  if (pathname === '/') return 0;
  return -1;
}

/**
 * Provides touch event handlers for swiping left/right to navigate
 * between bottom tab bar pages.
 *
 * Swipe left → next tab (rightward in nav bar)
 * Swipe right → previous tab (leftward in nav bar)
 */
export function useSwipeNavigation(): {
  ref: RefObject<HTMLDivElement | null>;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;

      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStart.current.x;
      const dy = touch.clientY - touchStart.current.y;
      touchStart.current = null;

      // Ignore if vertical movement is too large (scrolling)
      if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return;
      // Ignore if horizontal distance is below threshold
      if (Math.abs(dx) < SWIPE_THRESHOLD) return;

      const currentIndex = getActiveTabIndex(pathname);
      if (currentIndex === -1) return;

      let nextIndex: number;
      if (dx < 0) {
        // Swipe left → next tab
        nextIndex = currentIndex + 1;
      } else {
        // Swipe right → previous tab
        nextIndex = currentIndex - 1;
      }

      // Wrap around for circular navigation
      nextIndex = ((nextIndex % tabs.length) + tabs.length) % tabs.length;

      router.push(tabs[nextIndex].href);
    },
    [pathname, router],
  );

  const ref = useRef<HTMLDivElement | null>(null);

  return { ref, onTouchStart, onTouchEnd };
}
