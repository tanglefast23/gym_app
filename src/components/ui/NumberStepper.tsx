'use client';

import { useState, useCallback, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  suffix?: string;
  /** Aria label for the input */
  ariaLabel?: string;
}

/**
 * Compact mobile-friendly number input with −/+ stepper buttons.
 *
 * Touch targets are 44px minimum per WCAG/Apple HIG guidelines.
 * Tap the number to type directly via numpad.
 */
export const NumberStepper = ({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  label,
  suffix,
  ariaLabel,
}: NumberStepperProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  const atMin = value <= min;
  const atMax = value >= max;

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
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

  const handleValueClick = useCallback(() => {
    setIsEditing(true);
    setDraft(String(value));
    // Focus input on next tick after render
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value]);

  const commitDraft = useCallback(() => {
    const parsed = parseInt(draft, 10);
    if (!Number.isNaN(parsed)) {
      onChange(clamp(parsed));
    }
    setIsEditing(false);
  }, [draft, onChange, clamp]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        commitDraft();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [commitDraft],
  );

  const btnBase = [
    'flex items-center justify-center',
    'h-11 w-11 min-h-[44px] min-w-[44px]',
    'rounded-xl border border-border bg-elevated',
    'transition-all duration-100',
    'active:scale-90 active:bg-accent/20',
    'select-none',
  ].join(' ');

  return (
    <div className="flex flex-col">
      {label ? (
        <label className="mb-1 text-xs font-medium text-text-muted">
          {label}
        </label>
      ) : null}

      <div className="flex items-center gap-1.5">
        {/* Minus button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={atMin}
          className={`${btnBase} ${atMin ? 'opacity-30 cursor-not-allowed' : ''}`}
          aria-label={`Decrease ${ariaLabel ?? label ?? 'value'}`}
        >
          <Minus className="h-4 w-4 text-text-primary" />
        </button>

        {/* Value display / direct input */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={handleKeyDown}
            className="h-11 w-14 rounded-lg border border-accent bg-elevated text-center font-mono text-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
            aria-label={ariaLabel ?? label}
          />
        ) : (
          <button
            type="button"
            onClick={handleValueClick}
            className="flex h-11 min-w-[3rem] items-center justify-center rounded-lg px-2"
            aria-label={`Edit ${ariaLabel ?? label ?? 'value'}: ${value}`}
          >
            <span className="font-mono text-lg text-text-primary">
              {value}
            </span>
            {suffix ? (
              <span className="ml-0.5 text-xs text-text-muted">{suffix}</span>
            ) : null}
          </button>
        )}

        {/* Plus button */}
        <button
          type="button"
          onClick={handleIncrement}
          disabled={atMax}
          className={`${btnBase} ${atMax ? 'opacity-30 cursor-not-allowed' : ''}`}
          aria-label={`Increase ${ariaLabel ?? label ?? 'value'}`}
        >
          <Plus className="h-4 w-4 text-text-primary" />
        </button>
      </div>
    </div>
  );
};
