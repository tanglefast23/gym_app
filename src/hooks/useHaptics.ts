'use client';

import { useCallback } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

interface UseHapticsReturn {
  /** Short tap feedback (50ms) */
  tap: () => void;
  /** Medium feedback for button press (100ms) */
  press: () => void;
  /** Timer completion pattern [200, 100, 200] */
  timerComplete: () => void;
  /** Success pattern [100, 50, 100, 50, 200] */
  success: () => void;
}

/**
 * Sends a vibration pattern to the device if haptic feedback is enabled
 * in settings and the Vibration API is available.
 */
function vibrate(pattern: number | number[]): void {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

/**
 * React hook that wraps the Vibration API for haptic feedback.
 * Respects the `hapticFeedback` setting — when disabled, all
 * functions are no-ops. Gracefully degrades on devices that
 * do not support the Vibration API.
 */
export function useHaptics(): UseHapticsReturn {
  const hapticEnabled = useSettingsStore((s) => s.hapticFeedback);

  const tap = useCallback((): void => {
    if (!hapticEnabled) return;
    vibrate(50);
  }, [hapticEnabled]);

  const press = useCallback((): void => {
    if (!hapticEnabled) return;
    vibrate(100);
  }, [hapticEnabled]);

  const timerComplete = useCallback((): void => {
    if (!hapticEnabled) return;
    vibrate([200, 100, 200]);
  }, [hapticEnabled]);

  const success = useCallback((): void => {
    if (!hapticEnabled) return;
    vibrate([100, 50, 100, 50, 200]);
  }, [hapticEnabled]);

  return { tap, press, timerComplete, success };
}
