'use client';

import { useMemo } from 'react';
import { formatTime } from '@/lib/calculations';

interface TimerRingProps {
  remainingMs: number;
  totalMs: number;
  size?: number;
}

// Use CSS variable values so these respond to theme changes.
const COLOR_GREEN = 'var(--success, #22C55E)';
const COLOR_AMBER = 'var(--warning, #F59E0B)';
const COLOR_RED = 'var(--danger, #EF4444)';

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
        {/* Light-mode gradient for the progress ring */}
        <defs>
          <linearGradient id="light-timer-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--elevated, #1A1A1D)"
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
      <div
        className="relative z-10 flex flex-col items-center"
        role="timer"
        aria-label={`Rest timer: ${remainingSec} seconds remaining`}
      >
        <span
          className="font-timer text-[56px] leading-none text-text-primary"
          aria-hidden="true"
        >
          {timeDisplay}
        </span>
        <span className="mt-1 text-sm font-semibold uppercase tracking-[2px] text-text-secondary" aria-hidden="true">
          REST
        </span>
      </div>
    </div>
  );
}
