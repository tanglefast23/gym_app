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

async function unlockAudio(): Promise<void> {
  if (!isBrowser()) return;
  if (unlocked) return;
  unlocked = true;

  // iOS Safari requires a user-gesture-initiated audio action to "unlock"
  // the audio pipeline. We use a single silent AudioContext + oscillator
  // instead of playing every SFX file (which caused audible leaks on iOS PWA).
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') await ctx.resume();
    // Create a silent oscillator for 1ms to fully unlock the audio path.
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // completely silent
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.001);
    // Close context after a short delay — we only needed it for the unlock.
    setTimeout(() => ctx.close().catch(() => {}), 100);
  } catch {
    // Best-effort. Some devices/browsers will still refuse.
  }

  // Preload (but don't play) all audio elements so they're ready when needed.
  const keys = Object.keys(SFX) as SfxKey[];
  for (const key of keys) {
    getOrCreateAudio(key);
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
    void unlockAudio();
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
