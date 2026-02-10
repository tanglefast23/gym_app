'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import type { FontSize } from '@/types/workout';

const FONT_SIZE_CLASSES: readonly `font-size-${FontSize}`[] = [
  'font-size-S',
  'font-size-M',
  'font-size-L',
  'font-size-XL',
];

/**
 * Syncs the Zustand fontSize setting to a CSS class on <html>.
 * Renders nothing — side-effect only, same pattern as ThemeProvider.
 */
export function FontSizeProvider(): null {
  const fontSize = useSettingsStore((s) => s.fontSize);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove(...FONT_SIZE_CLASSES);
    root.classList.add(`font-size-${fontSize}`);
  }, [fontSize]);

  return null;
}
