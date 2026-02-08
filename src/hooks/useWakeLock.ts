'use client';

import { useRef, useCallback, useEffect, useState } from 'react';

interface UseWakeLockReturn {
  /** Request screen wake lock */
  request: () => Promise<void>;
  /** Release screen wake lock */
  release: () => Promise<void>;
  /** Whether wake lock is currently active */
  isActive: boolean;
}

/**
 * React hook that wraps the Screen Wake Lock API to keep the display on
 * during active workouts. Handles visibility-change re-acquisition
 * and graceful fallback when the API is unavailable.
 */
export function useWakeLock(): UseWakeLockReturn {
  const [isActive, setIsActive] = useState(false);

  const sentinelRef = useRef<WakeLockSentinel | null>(null);
  // Track whether the user has intentionally requested wake lock
  // so we can re-acquire after visibility changes.
  const wasActiveRef = useRef(false);

  const request = useCallback(async (): Promise<void> => {
    if (!('wakeLock' in navigator)) {
      console.warn(
        'useWakeLock: Screen Wake Lock API is not supported in this browser.'
      );
      return;
    }

    try {
      const sentinel = await navigator.wakeLock.request('screen');

      sentinel.addEventListener('release', () => {
        setIsActive(false);
        sentinelRef.current = null;
      });

      sentinelRef.current = sentinel;
      wasActiveRef.current = true;
      setIsActive(true);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.warn(`useWakeLock: Failed to acquire wake lock — ${message}`);
    }
  }, []);

  const release = useCallback(async (): Promise<void> => {
    wasActiveRef.current = false;

    if (!sentinelRef.current) {
      return;
    }

    try {
      await sentinelRef.current.release();
      sentinelRef.current = null;
      setIsActive(false);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.warn(`useWakeLock: Failed to release wake lock — ${message}`);
    }
  }, []);

  // Re-acquire wake lock when the page becomes visible again.
  // The browser automatically releases the sentinel when the page is hidden.
  useEffect(() => {
    function handleVisibilityChange(): void {
      if (
        document.visibilityState === 'visible' &&
        wasActiveRef.current &&
        !sentinelRef.current
      ) {
        // Fire-and-forget re-acquisition; errors are logged inside `request`
        void request();
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [request]);

  // Cleanup: release wake lock on unmount
  useEffect(() => {
    return () => {
      wasActiveRef.current = false;
      if (sentinelRef.current) {
        void sentinelRef.current.release().catch(() => {
          // Swallow errors during unmount cleanup
        });
        sentinelRef.current = null;
      }
    };
  }, []);

  return { request, release, isActive };
}
