'use client';

import { useState, useCallback, useRef } from 'react';
import { Minus, Plus } from 'lucide-react';

type StepperSize = 'sm' | 'lg';

/** Sentinel value stored in repsMax to indicate AMRAP mode. */
export const AMRAP_SENTINEL = 0;

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
  /** Size variant: 'lg' (56px buttons, 48px text) or 'sm' (40px buttons, 28px text). Default 'lg'. */
  size?: StepperSize;
  /** Whether AMRAP mode is currently active. */
  amrap?: boolean;
  /** Called when user long-presses the + button to toggle AMRAP. */
  onAmrapToggle?: () => void;
}

const LONG_PRESS_MS = 500;

/**
 * Compact mobile-friendly number input with −/+ stepper buttons.
 *
 * Touch targets are 44px minimum per WCAG/Apple HIG guidelines.
 * Tap the number to type directly via numpad.
 * Long-press the + button to toggle AMRAP mode (if onAmrapToggle is provided).
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
  size = 'lg',
  amrap = false,
  onAmrapToggle,
}: NumberStepperProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  const atMin = value <= min;
  const atMax = value >= max;

  const clamp = useCallback(
    (v: number) => Math.min(max, Math.max(min, v)),
    [min, max],
  );

  const handleDecrement = useCallback(() => {
    if (amrap) return;
    if (atMin) return;
    onChange(clamp(value - step));
  }, [value, step, atMin, amrap, onChange, clamp]);

  const handleIncrement = useCallback(() => {
    if (amrap) return;
    if (atMax) return;
    onChange(clamp(value + step));
  }, [value, step, atMax, amrap, onChange, clamp]);

  // --- Long-press detection for + button ---

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePlusPointerDown = useCallback(() => {
    if (!onAmrapToggle) return;
    didLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      longPressTimerRef.current = null;
      onAmrapToggle();
    }, LONG_PRESS_MS);
  }, [onAmrapToggle]);

  const handlePlusPointerUp = useCallback(() => {
    clearLongPress();
    // If it was NOT a long press, do a normal increment
    if (!didLongPressRef.current) {
      handleIncrement();
    }
  }, [clearLongPress, handleIncrement]);

  const handlePlusPointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  // --- Value editing ---

  const handleValueClick = useCallback(() => {
    if (amrap) return;
    setIsEditing(true);
    setDraft(String(value));
    requestAnimationFrame(() => inputRef.current?.select());
  }, [value, amrap]);

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

  const isSmall = size === 'sm';

  const btnBase = [
    'flex items-center justify-center',
    isSmall ? 'h-10 w-10' : 'h-14 w-14',
    'rounded-full border border-border bg-elevated',
    'transition-all duration-100',
    'active:scale-90 active:bg-accent/20',
    'select-none',
  ].join(' ');

  const iconClass = isSmall ? 'h-4 w-4 text-white' : 'h-6 w-6 text-white';
  const valueTextClass = isSmall
    ? 'font-timer text-[28px] text-text-primary'
    : 'font-timer text-5xl text-text-primary';
  const inputClass = isSmall
    ? 'h-10 w-14 rounded-lg border border-accent bg-elevated text-center font-timer text-[28px] text-text-primary focus:outline-none focus:ring-2 focus:ring-accent'
    : 'h-14 w-20 rounded-lg border border-accent bg-elevated text-center font-timer text-5xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent';
  const gapClass = isSmall ? 'gap-2' : 'gap-4';
  const minWidthClass = isSmall ? 'min-w-[2.5rem]' : 'min-w-[4rem]';

  const amrapTextClass = isSmall
    ? 'text-sm font-bold text-accent'
    : 'text-lg font-bold text-accent';

  return (
    <div className="flex flex-col items-center">
      {label ? (
        <label className="mb-1 text-xs font-medium text-text-muted">
          {label}
        </label>
      ) : null}

      <div className={`flex items-center ${gapClass}`}>
        {/* Minus button */}
        <button
          type="button"
          onClick={handleDecrement}
          disabled={atMin || amrap}
          className={`${btnBase} ${atMin || amrap ? 'opacity-30 cursor-not-allowed' : ''}`}
          aria-label={`Decrease ${ariaLabel ?? label ?? 'value'}`}
        >
          <Minus className={iconClass} />
        </button>

        {/* Value display */}
        {amrap ? (
          <div className={`flex ${minWidthClass} flex-col items-center justify-center`}>
            <span className={amrapTextClass}>AMRAP</span>
          </div>
        ) : isEditing ? (
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={handleKeyDown}
            className={inputClass}
            aria-label={ariaLabel ?? label}
          />
        ) : (
          <button
            type="button"
            onClick={handleValueClick}
            className={`flex ${minWidthClass} flex-col items-center justify-center`}
            aria-label={`Edit ${ariaLabel ?? label ?? 'value'}: ${value}`}
          >
            <span className={valueTextClass}>
              {value}
            </span>
            {suffix ? (
              <span className="text-sm text-text-secondary">{suffix}</span>
            ) : null}
          </button>
        )}

        {/* Plus button — supports long-press for AMRAP toggle */}
        <button
          type="button"
          onPointerDown={onAmrapToggle ? handlePlusPointerDown : undefined}
          onPointerUp={onAmrapToggle ? handlePlusPointerUp : undefined}
          onPointerLeave={onAmrapToggle ? handlePlusPointerLeave : undefined}
          onClick={onAmrapToggle ? undefined : handleIncrement}
          disabled={!amrap && atMax && !onAmrapToggle}
          className={`${btnBase} ${!amrap && atMax && !onAmrapToggle ? 'opacity-30 cursor-not-allowed' : ''}`}
          aria-label={`${onAmrapToggle ? 'Hold to toggle AMRAP. ' : ''}Increase ${ariaLabel ?? label ?? 'value'}`}
        >
          <Plus className={iconClass} />
        </button>
      </div>
    </div>
  );
};
