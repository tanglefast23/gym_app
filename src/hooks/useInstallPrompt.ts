'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Extended Event interface for the `beforeinstallprompt` browser event.
 * This event is non-standard and only available in Chromium-based browsers.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface UseInstallPromptReturn {
  /** Whether the install prompt is available */
  canInstall: boolean;
  /** Show the install prompt */
  promptInstall: () => Promise<void>;
}

/**
 * React hook that captures the deferred `beforeinstallprompt` event
 * so the app can trigger the PWA install banner at a convenient time
 * rather than immediately on page load.
 */
export function useInstallPrompt(): UseInstallPromptReturn {
  const [canInstall, setCanInstall] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event): void {
      // Prevent the default mini-infobar from appearing
      event.preventDefault();
      deferredPromptRef.current = event as BeforeInstallPromptEvent;
      setCanInstall(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<void> => {
    const deferredPrompt = deferredPromptRef.current;

    if (!deferredPrompt) {
      return;
    }

    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : String(error);
      console.warn(`useInstallPrompt: Install prompt failed — ${message}`);
    } finally {
      // Regardless of outcome, the prompt can only be used once
      deferredPromptRef.current = null;
      setCanInstall(false);
    }
  }, []);

  return { canInstall, promptInstall };
}
