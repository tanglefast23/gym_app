'use client';

import { useCallback } from 'react';
import { Minus, Plus } from 'lucide-react';

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
  /** Optional className for the value text (used for brief highlight animations). */
  valueClassName?: string;
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
  valueClassName,
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

  /**
   * Check whether a value sits on the step's fractional grid.
   * E.g. step=2.5 allows fractional parts 0.0 and 0.5;
   * step=1 allows only whole numbers.
   * Unaligned values (e.g. 80.3 from a unit conversion) should be
   * snapped to the nearest whole number on the first press.
   */
  const isStepAligned = useCallback(
    (v: number): boolean => {
      const epsilon = 0.01;
      const fStep = step % 1;
      const fValue = ((v % 1) + 1) % 1; // always-positive fractional part

      if (fStep < epsilon) {
        // Integer step: value must be (approximately) an integer
        return fValue < epsilon || fValue > 1 - epsilon;
      }

      // Fractional step: value's fractional part must be a multiple of step's
      const remainder = fValue % fStep;
      return remainder < epsilon || fStep - remainder < epsilon;
    },
    [step],
  );

  const handleDecrement = useCallback(() => {
    if (atMin) return;
    if (!isStepAligned(value)) {
      onChange(clamp(Math.floor(value)));
    } else {
      onChange(clamp(value - step));
    }
  }, [value, step, atMin, onChange, clamp, isStepAligned]);

  const handleIncrement = useCallback(() => {
    if (atMax) return;
    if (!isStepAligned(value)) {
      onChange(clamp(Math.ceil(value)));
    } else {
      onChange(clamp(value + step));
    }
  }, [value, step, atMax, onChange, clamp, isStepAligned]);

  const handleBigDecrement = useCallback(() => {
    if (!bigStep || atMin) return;
    if (!isStepAligned(value)) {
      onChange(clamp(Math.floor(value)));
    } else {
      onChange(clamp(value - bigStep));
    }
  }, [value, bigStep, atMin, onChange, clamp, isStepAligned]);

  const handleBigIncrement = useCallback(() => {
    if (!bigStep || atMax) return;
    if (!isStepAligned(value)) {
      onChange(clamp(Math.ceil(value)));
    } else {
      onChange(clamp(value + bigStep));
    }
  }, [value, bigStep, atMax, onChange, clamp, isStepAligned]);

  const displayValue = formatValue ? formatValue(value) : String(value);

  const btnBase = [
    'flex items-center justify-center',
    'rounded-full border border-border',
    'transition-all duration-150',
    'active:scale-95',
  ].join(' ');

  // Keep all circular buttons the same size for visual rhythm.
  const primaryBtn = `${btnBase} h-14 w-14 bg-surface`;
  const bigBtn = `${btnBase} h-14 w-14 bg-elevated`;
  const bigGlyph = 'font-mono text-[18px] font-bold leading-none text-text-primary';

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
            <span className={bigGlyph} aria-hidden="true">
              --
            </span>
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
          <span className={['inline-block font-mono text-2xl text-text-primary', valueClassName ?? ''].join(' ')}>
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
            <span className={bigGlyph} aria-hidden="true">
              ++
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
};
