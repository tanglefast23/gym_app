'use client';

import { useEffect, useCallback, useMemo } from 'react';
import { Clock, Layers, Weight, Trophy } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { useHaptics } from '@/hooks';
import { formatDuration, formatWeight } from '@/lib/calculations';
import { playSfx } from '@/lib/sfx';

export interface NewAchievementInfo {
  id: string;
  name: string;
  icon: string;
  iconSrc: string;
  context: string | null;
}

interface WorkoutCompleteProps {
  durationSec: number;
  totalSets: number;
  totalVolumeG: number;
  newAchievements?: NewAchievementInfo[];
  onFinish: () => void;
}

export const WorkoutComplete = ({
  durationSec,
  totalSets,
  totalVolumeG,
  newAchievements = [],
  onFinish,
}: WorkoutCompleteProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const haptics = useHaptics();

  // Play celebration sound when the completion screen appears
  useEffect(() => {
    playSfx('complete');
  }, []);

  // Haptic success pattern on mount
  useEffect(() => {
    haptics.success();
  }, [haptics]);

  const handleFinish = useCallback(() => {
    haptics.tap();
    onFinish();
  }, [haptics, onFinish]);

  const hasPR = useMemo(
    () => newAchievements.some((a) => a.id === 'pr-1rm' || a.id === 'volume-king'),
    [newAchievements],
  );

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-8">
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
        {hasPR ? (
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-accent">
            <Trophy className="h-4 w-4" />
            New Personal Record!
          </p>
        ) : null}
      </div>

      {/* Stats grid — staggered entrance */}
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        {/* Duration */}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-accent/20 bg-surface p-4 animate-reveal-up" style={{ animationDelay: '350ms' }}>
          <Clock className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold text-text-primary">
            {formatDuration(durationSec)}
          </span>
          <span className="text-xs text-text-secondary">Duration</span>
        </div>

        {/* Total Sets */}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-accent/20 bg-surface p-4 animate-reveal-up" style={{ animationDelay: '450ms' }}>
          <Layers className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold text-text-primary">
            {totalSets}
          </span>
          <span className="text-xs text-text-secondary">Total Sets</span>
        </div>

        {/* Total Volume -- spans both columns */}
        <div className="col-span-2 flex flex-col items-center gap-2 rounded-xl border border-accent/20 bg-accent/5 p-4 animate-reveal-up" style={{ animationDelay: '550ms' }}>
          <Weight className="h-5 w-5 text-accent" />
          <span className="text-lg font-semibold text-text-primary">
            {formatWeight(totalVolumeG, unitSystem)}
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
