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

export const TimerRing = ({
  remainingMs,
  totalMs,
  size = 200,
}: TimerRingProps) => {
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
      className={isPulsing ? 'animate-timer-pulse' : ''}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block"
      >
        {/* Background ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-text-muted"
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

        {/* Center time display */}
        <text
          x={center}
          y={center}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-text-primary font-mono text-4xl font-bold"
          style={{ fontSize: size * 0.2 }}
        >
          {timeDisplay}
        </text>
      </svg>

      {/* Inline styles for the pulse animation */}
      <style jsx>{`
        @keyframes timer-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }
        .animate-timer-pulse {
          animation: timer-pulse 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
