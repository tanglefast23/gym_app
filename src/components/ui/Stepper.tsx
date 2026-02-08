'use client';

import { useCallback } from 'react';
import { Minus, Plus, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  step: number;
  /** Optional large step for double-tap buttons (e.g. ±5 kg). */
  bigStep?: number;
  min?: number;
  max?: number;
  label?: string;
  formatValue?: (v: number) => string;
}

export const Stepper = ({
  value,
  onChange,
  step,
  bigStep,
  min,
  max,
  label,
  formatValue,
}: StepperProps) => {
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;

  const clamp = useCallback(
    (v: number) => {
      let clamped = v;
      if (min !== undefined) clamped = Math.max(min, clamped);
      if (max !== undefined) clamped = Math.min(max, clamped);
      return clamped;
    },
    [min, max],
  );

  const handleDecrement = useCallback(() => {
    if (atMin) return;
    onChange(clamp(value - step));
  }, [value, step, atMin, onChange, clamp]);

  const handleIncrement = useCallback(() => {
    if (atMax) return;
    onChange(clamp(value + step));
  }, [value, step, atMax, onChange, clamp]);

  const handleBigDecrement = useCallback(() => {
    if (!bigStep || atMin) return;
    onChange(clamp(value - bigStep));
  }, [value, bigStep, atMin, onChange, clamp]);

  const handleBigIncrement = useCallback(() => {
    if (!bigStep || atMax) return;
    onChange(clamp(value + bigStep));
  }, [value, bigStep, atMax, onChange, clamp]);

  const displayValue = formatValue ? formatValue(value) : String(value);

  const btnBase = [
    'flex items-center justify-center',
    'rounded-full border border-border',
    'transition-all duration-150',
    'active:scale-95',
  ].join(' ');

  const primaryBtn = `${btnBase} h-14 w-14 bg-surface`;
  const bigBtn = `${btnBase} h-11 w-11 bg-elevated`;

  return (
    <div className="flex flex-col items-center gap-2" role="group" aria-label={label ?? 'Value stepper'}>
      {label ? (
        <span className="text-sm font-medium text-text-secondary">
          {label}
        </span>
      ) : null}

      <div className="flex items-center gap-3">
        {/* Big minus button */}
        {bigStep ? (
          <button
            type="button"
            onClick={handleBigDecrement}
            disabled={atMin}
            className={`${bigBtn} ${atMin ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
            aria-label={`Decrease by ${bigStep}`}
          >
            <ChevronsLeft className="h-4 w-4 text-text-primary" />
          </button>
        ) : null}

        {/* Minus button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={atMin}
          className={`${primaryBtn} ${atMin ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
          aria-label={`Decrease by ${step}`}
        >
          <Minus className="h-5 w-5 text-text-primary" />
        </button>

        {/* Value display */}
        <div className="min-w-[80px] text-center" aria-live="polite" aria-atomic="true">
          <span className="font-mono text-2xl text-text-primary">
            {displayValue}
          </span>
        </div>

        {/* Plus button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={atMax}
          className={`${primaryBtn} ${atMax ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
          aria-label={`Increase by ${step}`}
        >
          <Plus className="h-5 w-5 text-text-primary" />
        </button>

        {/* Big plus button */}
        {bigStep ? (
          <button
            type="button"
            onClick={handleBigIncrement}
            disabled={atMax}
            className={`${bigBtn} ${atMax ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80'}`}
            aria-label={`Increase by ${bigStep}`}
          >
            <ChevronsRight className="h-4 w-4 text-text-primary" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
