// Centralized sound effects (SFX) manager.
//
// Goals:
// - One place to map SFX keys -> asset URLs
// - Respect the user's "Sound" toggle (and timer sound toggles where relevant)
// - Preload/unlock audio for iOS Safari so timer beeps can play programmatically
// - Use Web Audio API (AudioContext + AudioBuffer) so short SFX mix with
//   background music (e.g. Apple Music) instead of interrupting it.
//   HTMLAudioElement claims the iOS "playback" audio session and pauses
//   background audio; AudioContext uses "ambient" mixing by default.

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

export interface SfxSoundSettings {
  soundEnabled: boolean;
  restTimerSound: boolean;
}

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

// --- Web Audio API state ---
let audioCtx: AudioContext | null = null;
const bufferCache = new Map<string, AudioBuffer>();
let unlockInitialized = false;
let unlocked = false;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function isSoundAllowed(
  key: SfxKey,
  settings: SfxSoundSettings,
): boolean {
  const { soundEnabled, restTimerSound } = settings;
  if (!soundEnabled) return false;

  const category = SFX[key].category;
  if (category === 'timer') return restTimerSound;
  return true;
}

function getAudioContext(): AudioContext | null {
  if (!isBrowser()) return null;
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Fetch and decode an audio file into an AudioBuffer, with caching by URL.
 */
async function getBuffer(url: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(url);
  if (cached) return cached;

  const ctx = getAudioContext();
  if (!ctx) return null;

  try {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    bufferCache.set(url, audioBuffer);
    return audioBuffer;
  } catch {
    return null;
  }
}

async function unlockAudio(): Promise<void> {
  if (!isBrowser()) return;
  if (unlocked) return;
  unlocked = true;

  const ctx = getAudioContext();
  if (!ctx) return;

  // iOS Safari requires a user-gesture-initiated audio action to "unlock"
  // the audio pipeline. We play a silent oscillator for 1ms to unlock it.
  try {
    if (ctx.state === 'suspended') await ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0; // completely silent
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.001);
  } catch {
    // Best-effort. Some devices/browsers will still refuse.
  }

  // Preload all unique audio files into the buffer cache.
  const urls = new Set(Object.values(SFX).map((s) => s.url));
  for (const url of urls) {
    void getBuffer(url);
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

/**
 * Play a sound effect by key.
 *
 * Uses Web Audio API so SFX mix with background music (Apple Music, Spotify,
 * etc.) instead of pausing it. Each call creates a new AudioBufferSourceNode
 * which is lightweight and auto-disposes after playback.
 *
 * @param key - Which SFX to play.
 * @param settings.soundEnabled - Master sound toggle state.
 * @param settings.restTimerSound - Whether timer-category sounds are allowed.
 * @param opts.volume - Override the default volume for this SFX.
 */
export function playSfx(
  key: SfxKey,
  settings: SfxSoundSettings,
  opts?: { volume?: number },
): void {
  if (!isBrowser()) return;

  if (!isSoundAllowed(key, settings)) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const sfx = SFX[key];

  // Resume context if it was suspended (e.g. autoplay policy).
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }

  const cached = bufferCache.get(sfx.url);
  if (cached) {
    playBuffer(ctx, cached, opts?.volume ?? sfx.volume);
  } else {
    // Buffer not yet loaded — fetch, decode, then play.
    void getBuffer(sfx.url).then((buf) => {
      if (buf) playBuffer(ctx, buf, opts?.volume ?? sfx.volume);
    });
  }
}

function playBuffer(ctx: AudioContext, buffer: AudioBuffer, volume: number): void {
  try {
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.buffer = buffer;
    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  } catch {
    // Audio playback is best-effort.
  }
}
