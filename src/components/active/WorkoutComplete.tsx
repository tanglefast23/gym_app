'use client';

import { useEffect, useCallback } from 'react';
import { Clock, Layers, Weight } from 'lucide-react';
import { Button } from '@/components/ui';
import { useSettingsStore } from '@/stores/settingsStore';
import { useHaptics } from '@/hooks';
import { formatDuration, formatWeight } from '@/lib/calculations';
import { playSfx } from '@/lib/sfx';

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

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6 py-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/visuals/celebrate/workout-complete.svg"
        alt=""
        className="w-[300px] max-w-full select-none"
        draggable={false}
      />

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
    </div>
  );
};
