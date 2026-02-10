'use client';

import { useSettingsStore } from '@/stores/settingsStore';

/**
 * A compact button that displays the current font size label (S / M / L / XL)
 * and cycles through sizes on tap: M → L → XL → S → M …
 *
 * Designed for the Header rightAction slot — matches the 44×44 circle style
 * of the settings gear button.
 */
export function FontSizeToggle() {
  const fontSize = useSettingsStore((s) => s.fontSize);
  const cycle = useSettingsStore((s) => s.cycleFontSize);

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Font size: ${fontSize}. Tap to change.`}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated"
    >
      <span className="text-xs font-bold leading-none text-text-secondary">
        {fontSize}
      </span>
    </button>
  );
}
