'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ThemeMode } from '@/types/workout';

/**
 * Applies the theme class to the document root element.
 * Handles system preference detection for 'system' mode.
 */
function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement;

  if (theme === 'system') {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.remove('dark', 'light');
    root.classList.add(prefersDark ? 'dark' : 'light');
  } else {
    root.classList.remove('dark', 'light');
    root.classList.add(theme);
  }

  // Update meta theme-color for PWA
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const isDark = root.classList.contains('dark');
    metaThemeColor.setAttribute('content', isDark ? '#0A0A0B' : '#FFF9F5');
  }
}

/**
 * ThemeProvider synchronizes the Zustand theme setting with the DOM.
 * It applies the appropriate class to <html> and listens for system
 * preference changes when in 'system' mode.
 *
 * This component renders nothing - it only manages side effects.
 */
export function ThemeProvider(): null {
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    // Apply theme immediately
    applyTheme(theme);

    // If in system mode, listen for preference changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return null;
}
