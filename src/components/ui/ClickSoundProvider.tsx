'use client';

import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

const CLICK_SFX_URL = '/sfx/click2.webm';

/**
 * Global click-sound provider.
 *
 * Listens for clicks on any `<button>` element in the document and plays
 * click2.webm when master sound is enabled. Mount once in the root layout.
 *
 * Uses event delegation so every current and future button is covered
 * without per-component wiring.
 */
export function ClickSoundProvider(): null {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (!useSettingsStore.getState().soundEnabled) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Walk up the DOM to see if the click landed inside a <button>
      const button = target.closest('button');
      if (!button) return;

      // Skip disabled buttons
      if (button.disabled) return;

      try {
        if (!audioRef.current) {
          audioRef.current = new Audio(CLICK_SFX_URL);
        }
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      } catch {
        // Audio playback is best-effort
      }
    }

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [soundEnabled]);

  return null;
}
