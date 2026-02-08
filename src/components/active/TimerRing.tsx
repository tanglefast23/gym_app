'use client';

import { useMemo } from 'react';
import { formatTime } from '@/lib/calculations';

interface TimerRingProps {
  remainingMs: number;
  totalMs: number;
  size?: number;
}

const COLOR_GREEN = '#22C55E';
const COLOR_AMBER = '#F59E0B';
const COLOR_RED = '#EF4444';

function getStrokeColor(fraction: number): string {
  if (fraction >= 0.66) return COLOR_GREEN;
  if (fraction >= 0.33) return COLOR_AMBER;
  return COLOR_RED;
}

export function TimerRing({
  remainingMs,
  totalMs,
  size = 200,
}: TimerRingProps) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  const fraction = totalMs > 0 ? Math.max(0, remainingMs / totalMs) : 0;
  const dashoffset = circumference * (1 - fraction);
  const strokeColor = getStrokeColor(fraction);

  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const isPulsing = remainingSec <= 3 && remainingSec > 0;

  const timeDisplay = useMemo(
    () => formatTime(remainingSec),
    [remainingSec],
  );

  return (
    <div
      className={[
        'relative flex items-center justify-center',
        isPulsing ? 'animate-timer-pulse' : '',
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="absolute inset-0 block"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1A1A1D"
          strokeWidth={strokeWidth}
        />

        {/* Progress ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          className="transition-[stroke-dashoffset] duration-200 ease-linear"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
          }}
        />
      </svg>

      {/* Center time display + REST label */}
      <div className="relative z-10 flex flex-col items-center">
        <span
          className="font-timer text-text-primary"
          style={{ fontSize: 72, lineHeight: 1 }}
        >
          {timeDisplay}
        </span>
        <span className="mt-1 text-sm font-semibold uppercase tracking-[2px] text-text-secondary">
          REST
        </span>
      </div>
    </div>
  );
}
