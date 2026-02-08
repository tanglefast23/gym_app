'use client';

import { useEffect, useRef, useCallback } from 'react';
import { Clock, Layers, Weight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { useHaptics } from '@/hooks';
import { formatDuration, formatWeight } from '@/lib/calculations';

const COMPLETE_SFX_URL = '/sfx/angels.webm';

interface WorkoutCompleteProps {
  durationSec: number;
  totalSets: number;
  totalVolumeG: number;
  onFinish: () => void;
}

export const WorkoutComplete = ({
  durationSec,
  totalSets,
  totalVolumeG,
  onFinish,
}: WorkoutCompleteProps) => {
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const soundEnabled = useSettingsStore((s) => s.soundEnabled);
  const haptics = useHaptics();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play celebration sound when the completion screen appears
  useEffect(() => {
    if (!soundEnabled) return;
    try {
      audioRef.current = new Audio(COMPLETE_SFX_URL);
      audioRef.current.play().catch(() => {});
    } catch {
      // Audio playback is best-effort
    }
  }, [soundEnabled]);

  // Haptic success pattern on mount
  useEffect(() => {
    haptics.success();
  }, [haptics]);

  const handleFinish = useCallback(() => {
    haptics.tap();
    onFinish();
  }, [haptics, onFinish]);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-8">
      {/* Animated checkmark */}
      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-accent">
        <svg
          className="checkmark-draw h-12 w-12 text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline
            points="4 12 9 17 20 6"
            className="checkmark-path"
          />
        </svg>
      </div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-text-primary">
        Workout Complete!
      </h2>

      {/* Stats grid */}
      <div className="grid w-full max-w-sm grid-cols-2 gap-4">
        {/* Duration */}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface p-4">
          <Clock className="h-5 w-5 text-text-muted" />
          <span className="text-lg font-semibold text-text-primary">
            {formatDuration(durationSec)}
          </span>
          <span className="text-xs text-text-secondary">Duration</span>
        </div>

        {/* Total Sets */}
        <div className="flex flex-col items-center gap-2 rounded-xl bg-surface p-4">
          <Layers className="h-5 w-5 text-text-muted" />
          <span className="text-lg font-semibold text-text-primary">
            {totalSets}
          </span>
          <span className="text-xs text-text-secondary">Total Sets</span>
        </div>

        {/* Total Volume -- spans both columns */}
        <div className="col-span-2 flex flex-col items-center gap-2 rounded-xl bg-surface p-4">
          <Weight className="h-5 w-5 text-text-muted" />
          <span className="text-lg font-semibold text-text-primary">
            {formatWeight(totalVolumeG, unitSystem)}
          </span>
          <span className="text-xs text-text-secondary">Total Volume</span>
        </div>
      </div>

      {/* Done button */}
      <div className="mt-auto w-full">
        <Button
          size="lg"
          fullWidth
          onClick={handleFinish}
        >
          Done
        </Button>
      </div>

      {/* Checkmark draw-on animation */}
      <style jsx>{`
        @keyframes checkmark-draw {
          0% {
            stroke-dashoffset: 30;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
        .checkmark-path {
          stroke-dasharray: 30;
          stroke-dashoffset: 30;
          animation: checkmark-draw 0.6s ease-out 0.3s forwards;
        }
      `}</style>
    </div>
  );
};
