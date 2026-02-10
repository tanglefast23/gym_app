'use client';

import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { Clock, Layers, Weight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { useHaptics } from '@/hooks';
import { formatDuration, formatWeight } from '@/lib/calculations';
import { playSfx } from '@/lib/sfx';
import type { NewAchievementInfo } from '@/types/workout';
import type { PersonalRecordSummary } from '@/lib/personalRecords';

interface WorkoutCompleteProps {
  durationSec: number;
  totalSets: number;
  totalVolumeG: number;
  personalRecords?: PersonalRecordSummary;
  newAchievements?: NewAchievementInfo[];
  onFinish: () => void;
}

function useCountUp(target: number, durationMs = 850): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = 0;

    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

type ConfettiPiece = {
  key: string;
  x: number;
  y: number;
  r: number;
  delayMs: number;
  color: string;
};

function ConfettiBurst(): React.JSX.Element {
  // Check if we're in light mode for playful colors
  const isLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  const pieces = useMemo<ConfettiPiece[]>(() => {
    // Dark mode: amber/gold/neutral, Light mode: rainbow playful
    const darkColors = ['#F59E0B', '#FFD08A', '#ADADB0', '#FFFFFF'];
    const lightColors = ['#F97316', '#EC4899', '#A855F7', '#4ECDC4', '#84CC16', '#FBBF24'];
    const colors = isLight ? lightColors : darkColors;
    const count = 28;
    const out: ConfettiPiece[] = [];
    const rand01 = (n: number): number => {
      // Deterministic pseudo-random (pure): stable across renders/strict mode.
      const x = Math.sin(n * 9999.123) * 10000;
      return x - Math.floor(x);
    };
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 140 + rand01(i + 1) * 140;
      out.push({
        key: `c${i}`,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius - 40,
        r: ((rand01(i + 11) * 720 - 360) | 0),
        delayMs: Math.floor(rand01(i + 21) * 250),
        color: colors[i % colors.length]!,
      });
    }
    return out;
  }, [isLight]);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {pieces.map((p) => (
        <span
          key={p.key}
          className="confetti-piece"
          style={
            {
              '--x': `${p.x}px`,
              '--y': `${p.y}px`,
              '--r': `${p.r}deg`,
              '--c': p.color,
              animationDelay: `${p.delayMs}ms`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

export const WorkoutComplete = ({
  durationSec,
  totalSets,
  totalVolumeG,
  personalRecords,
  newAchievements = [],
  onFinish,
}: WorkoutCompleteProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const haptics = useHaptics();

  // Play celebration sound when the completion screen appears
  useEffect(() => {
    const { soundEnabled, restTimerSound } = useSettingsStore.getState();
    playSfx('complete', { soundEnabled, restTimerSound });
  }, []);

  // Haptic success pattern on mount
  useEffect(() => {
    haptics.success();
  }, [haptics]);

  const durationAnimSec = Math.round(useCountUp(durationSec, 900));
  const setsAnim = Math.round(useCountUp(totalSets, 750));
  const volumeAnimG = Math.round(useCountUp(totalVolumeG, 900));

  const handleFinish = useCallback(() => {
    haptics.tap();
    onFinish();
  }, [haptics, onFinish]);

  const prExerciseIds = useMemo(() => {
    const ids = new Set<string>();
    for (const p of personalRecords?.oneRm ?? []) ids.add(p.exerciseId);
    for (const p of personalRecords?.volume ?? []) ids.add(p.exerciseId);
    return ids;
  }, [personalRecords]);
  const prCount = prExerciseIds.size;

  const prLabel = useMemo(() => {
    if (!personalRecords) return null;
    const parts: string[] = [];
    if ((personalRecords.oneRm?.length ?? 0) > 0) parts.push('1RM');
    if ((personalRecords.volume?.length ?? 0) > 0) parts.push('Volume');
    if (parts.length === 0) return null;
    const suffix = prCount > 1 ? `x${prCount}` : null;
    return `${parts.join(' + ')} PR${prCount === 1 ? '' : 's'}${suffix ? ` ${suffix}` : ''}`;
  }, [personalRecords, prCount]);

  // Long-press easter egg on Total Volume.
  const [funVolume, setFunVolume] = useState(false);
  const longPressRef = useRef<number | null>(null);
  const funVolumeTimeoutRef = useRef<number | null>(null);

  const funVolumeText = useMemo(() => {
    const volumeKg = totalVolumeG / 1000;
    const carKg = 1200;
    const times = volumeKg / carKg;
    if (!Number.isFinite(times) || times <= 0) return null;
    const nice = times < 1 ? times.toFixed(2) : times < 10 ? times.toFixed(1) : Math.round(times).toString();
    return `That's like lifting a small car ~${nice} times`;
  }, [totalVolumeG]);

  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Cleanup any in-flight timeouts on unmount.
  useEffect(() => {
    return () => {
      if (longPressRef.current !== null) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
      if (funVolumeTimeoutRef.current !== null) {
        clearTimeout(funVolumeTimeoutRef.current);
        funVolumeTimeoutRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-8 px-6 py-8">
      {!prefersReducedMotion && <ConfettiBurst />}

      {/* Hero illustration — dramatic scale-in entrance */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/visuals/celebrate/workout-complete.svg"
        alt=""
        className="w-[300px] max-w-full select-none animate-hero-scale-in"
        draggable={false}
      />

      {/* Title + PR badge */}
      <div className="text-center animate-reveal-up" style={{ animationDelay: '200ms' }}>
        <h2 className="text-3xl font-bold text-text-primary">
          Workout Complete!
        </h2>
        {prLabel ? (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full btn-gradient bg-accent px-3.5 py-1.5 text-xs font-semibold text-white">
            <Trophy className="h-3.5 w-3.5" />
            NEW PR {prLabel}
          </span>
        ) : null}
      </div>

      {/* Stats grid — staggered entrance */}
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        {/* Duration — orange accent */}
        <div className="stat-card-orange flex flex-col items-center gap-2 rounded-xl border border-accent/20 bg-surface p-4 animate-reveal-up" style={{ animationDelay: '350ms' }}>
          <Clock className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold text-text-primary">
            {formatDuration(durationAnimSec)}
          </span>
          <span className="text-xs text-text-secondary">Duration</span>
        </div>

        {/* Total Sets — purple accent */}
        <div className="stat-card-purple flex flex-col items-center gap-2 rounded-xl border border-accent/20 bg-surface p-4 animate-reveal-up" style={{ animationDelay: '450ms' }}>
          <Layers className="h-5 w-5 text-purple" />
          <span className="text-lg font-semibold text-text-primary">
            {setsAnim}
          </span>
          <span className="text-xs text-text-secondary">Total Sets</span>
        </div>

        {/* Total Volume — teal accent, spans both columns */}
        <div
          className="stat-card-teal col-span-2 flex flex-col items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 p-4 animate-reveal-up"
          style={{ animationDelay: '550ms' }}
          onPointerDown={() => {
            if (!funVolumeText) return;
            if (longPressRef.current !== null) return;
            longPressRef.current = window.setTimeout(() => {
              longPressRef.current = null;
              setFunVolume(true);
              if (funVolumeTimeoutRef.current !== null) {
                clearTimeout(funVolumeTimeoutRef.current);
              }
              funVolumeTimeoutRef.current = window.setTimeout(() => {
                funVolumeTimeoutRef.current = null;
                setFunVolume(false);
              }, 2000);
            }, 650);
          }}
          onPointerUp={() => {
            if (longPressRef.current !== null) {
              clearTimeout(longPressRef.current);
              longPressRef.current = null;
            }
          }}
          onPointerCancel={() => {
            if (longPressRef.current !== null) {
              clearTimeout(longPressRef.current);
              longPressRef.current = null;
            }
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <Weight className="h-5 w-5 text-teal" />
          <span className="text-lg font-semibold text-text-primary">
            {funVolume && funVolumeText
              ? funVolumeText
              : formatWeight(volumeAnimG, unitSystem)}
          </span>
          <span className="text-xs text-text-secondary">Total Volume</span>
        </div>
      </div>

      {/* Newly unlocked achievements */}
      {newAchievements.length > 0 ? (
        <div className="w-full max-w-sm animate-reveal-up" style={{ animationDelay: '650ms' }}>
          <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[1px] text-text-muted">
            Unlocked
          </p>
          <div className="flex justify-center gap-3">
            {newAchievements.map((a) => (
              <div
                key={a.id}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-warning/40 bg-surface p-3 animate-shimmer"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.iconSrc}
                  alt=""
                  className="h-10 w-10 select-none"
                  draggable={false}
                />
                <span className="text-xs font-semibold text-text-primary">{a.name}</span>
                {a.context ? (
                  <span className="text-[10px] text-accent">{a.context}</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Done button — last to appear, with glow */}
      <div className="mt-auto w-full animate-reveal-up" style={{ animationDelay: '700ms' }}>
        <Button
          size="lg"
          fullWidth
          onClick={handleFinish}
          className="animate-pulse-glow"
        >
          Done
        </Button>
      </div>
    </div>
  );
};
