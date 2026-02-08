// Centralized sound effects (SFX) manager.
//
// Goals:
// - One place to map SFX keys -> asset URLs
// - Respect the user's "Sound" toggle (and timer sound toggles where relevant)
// - Preload/unlock audio for iOS Safari so timer beeps can play programmatically

import { useSettingsStore } from '@/stores/settingsStore';

export type SfxKey =
  | 'click'
  | 'tab'
  | 'confirm'
  | 'cancel'
  | 'danger'
  | 'sheetClose'
  | 'timerDone'
  | 'countdown'
  | 'complete'
  | 'success';

type SfxCategory = 'ui' | 'timer' | 'celebration';

const SFX: Record<SfxKey, { url: string; category: SfxCategory; volume: number }> =
  {
    // UI taps (generic)
    click: { url: '/sfx/click2.webm', category: 'ui', volume: 0.5 },
    tab: { url: '/sfx/click2.webm', category: 'ui', volume: 0.5 },
    confirm: { url: '/sfx/click2.webm', category: 'ui', volume: 0.5 },
    cancel: { url: '/sfx/click2.webm', category: 'ui', volume: 0.5 },
    danger: { url: '/sfx/click2.webm', category: 'ui', volume: 0.5 },
    sheetClose: { url: '/sfx/click2.webm', category: 'ui', volume: 0.5 },

    // Workout timer
    timerDone: { url: '/sfx/level-up-2-199574.webm', category: 'timer', volume: 0.5 },
    countdown: { url: '/sfx/negative_sound.webm', category: 'timer', volume: 0.5 },

    // Celebration
    complete: { url: '/sfx/angels.webm', category: 'celebration', volume: 0.5 },

    // Success confirmation (e.g. save partial, apply to remaining)
    success: { url: '/sfx/level-up-2-199574.webm', category: 'ui', volume: 0.5 },
  };

const audioMap = new Map<SfxKey, HTMLAudioElement>();
let unlockInitialized = false;
let unlocked = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isSoundAllowed(key: SfxKey): boolean {
  const { soundEnabled, restTimerSound } = useSettingsStore.getState();
  if (!soundEnabled) return false;

  const category = SFX[key].category;
  if (category === 'timer') return restTimerSound;
  return true;
}

function getOrCreateAudio(key: SfxKey): HTMLAudioElement {
  const existing = audioMap.get(key);
  if (existing) return existing;
  const audio = new Audio(SFX[key].url);
  audio.preload = 'auto';
  audioMap.set(key, audio);
  return audio;
}

async function unlockAllAudio(): Promise<void> {
  if (!isBrowser()) return;
  if (unlocked) return;
  unlocked = true;

  const keys = Object.keys(SFX) as SfxKey[];
  for (const key of keys) {
    try {
      const audio = getOrCreateAudio(key);
      const prevVolume = audio.volume;
      audio.volume = 0;
      // iOS: must be inside a user gesture; play -> pause is enough to unlock.
      audio
        .play()
        .then(() => {
          audio.pause();
          audio.currentTime = 0;
          audio.volume = prevVolume;
        })
        .catch(() => {
          audio.volume = prevVolume;
        });
    } catch {
      // Best-effort. Some devices/browsers will still refuse.
    }
  }
}

/**
 * Set up one-time audio "unlock" listeners (iOS Safari requirement).
 * Safe to call multiple times.
 */
export function initSfxUnlock(): void {
  if (!isBrowser()) return;
  if (unlockInitialized) return;
  unlockInitialized = true;

  const handler = () => {
    void unlockAllAudio();
  };

  // `touchstart` is important for iOS; `click` is a fallback.
  document.addEventListener('touchstart', handler, { passive: true, once: true });
  document.addEventListener('click', handler, { passive: true, once: true });
}

export function isSfxKey(value: string): value is SfxKey {
  return (Object.keys(SFX) as string[]).includes(value);
}

export function playSfx(
  key: SfxKey,
  opts?: { volume?: number },
): void {
  if (!isBrowser()) return;
  if (!isSoundAllowed(key)) return;

  try {
    const audio = getOrCreateAudio(key);
    audio.volume = opts?.volume ?? SFX[key].volume;
    // Restart so repeated taps are crisp.
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } catch {
    // Audio playback is best-effort.
  }
}
