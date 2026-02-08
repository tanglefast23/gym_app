'use client';

import { useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step: number;
  min?: number;
  max?: number;
  label?: string;
  formatValue?: (v: number) => string;
}

export const Stepper = ({
  value,
  onChange,
  step,
  min,
  max,
  label,
  formatValue,
}: StepperProps) => {
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  const handleDecrement = useCallback(() => {
    if (atMin) return;
    const newValue = value - step;
    onChange(min !== undefined ? Math.max(min, newValue) : newValue);
  }, [value, step, min, atMin, onChange]);

  const handleIncrement = useCallback(() => {
    if (atMax) return;
    const newValue = value + step;
    onChange(max !== undefined ? Math.min(max, newValue) : newValue);
  }, [value, step, max, atMax, onChange]);

  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className="flex flex-col items-center gap-2">
      {label ? (
        <span className="text-sm font-medium text-text-secondary">
          {label}
        </span>
      ) : null}

      <div className="flex items-center gap-6">
        {/* Minus button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={atMin}
          className={[
            'flex h-14 w-14 items-center justify-center',
            'rounded-full bg-surface border border-border',
            'transition-all duration-150',
            'active:scale-95',
            atMin
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:opacity-80',
          ].join(' ')}
          aria-label={`Decrease by ${step}`}
        >
          <Minus className="h-5 w-5 text-text-primary" />
        </button>

        {/* Value display */}
        <div className="min-w-[80px] text-center">
          <span className="text-2xl font-mono text-text-primary">
            {displayValue}
          </span>
        </div>

        {/* Plus button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={atMax}
          className={[
            'flex h-14 w-14 items-center justify-center',
            'rounded-full bg-surface border border-border',
            'transition-all duration-150',
            'active:scale-95',
            atMax
              ? 'opacity-50 cursor-not-allowed'
              : 'hover:opacity-80',
          ].join(' ')}
          aria-label={`Increase by ${step}`}
        >
          <Plus className="h-5 w-5 text-text-primary" />
        </button>
      </div>
    </div>
  );
};
