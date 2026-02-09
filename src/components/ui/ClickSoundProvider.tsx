'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { initSfxUnlock, isSfxKey, playSfx } from '@/lib/sfx';

/**
 * Global click-sound provider.
 *
 * Listens for clicks on interactive UI elements and plays SFX when the master
 * sound toggle is enabled. Mount once in the root layout.
 *
 * Uses event delegation so every current and future button is covered
 * without per-component wiring.
 */
export function ClickSoundProvider(): null {
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);

  useEffect(() => {
    // iOS Safari requires an initial user gesture to allow later programmatic
    // audio playback (e.g. timer beeps). We set up a one-time unlock listener.
    initSfxUnlock();

    function handleClick(e: MouseEvent): void {
      if (!useSettingsStore.getState().soundEnabled) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Prefer an explicit SFX override.
      const sfxEl = target.closest<HTMLElement>('[data-sfx]');
      const requested = sfxEl?.dataset.sfx;

      // Otherwise, treat common interactive elements as "click".
      const interactive = target.closest<HTMLElement>('button, a');
      let key: Parameters<typeof playSfx>[0] | null = null;
      if (requested && isSfxKey(requested)) {
        key = requested;
      } else if (interactive && !target.closest<HTMLElement>('[data-no-click-sfx]')) {
        key = 'click';
      }
      if (!key) return;

      // Skip disabled/aria-disabled
      if (interactive instanceof HTMLButtonElement && interactive.disabled) return;
      if (interactive?.getAttribute('aria-disabled') === 'true') return;

      playSfx(key);
    }

    document.addEventListener('click', handleClick, { passive: true });
    return () => document.removeEventListener('click', handleClick);
  }, [soundEnabled]);

  return null;
}
