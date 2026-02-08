'use client';

import { type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BottomTabBar } from './BottomTabBar';

interface AppShellProps {
  children: ReactNode;
}

/** Pathnames where the bottom tab bar should be hidden. */
const HIDDEN_TAB_BAR_PREFIXES = ['/workout/', '/settings'] as const;

/**
 * Checks whether the tab bar should be hidden for the current route.
 * Active workout screens and settings are full-screen experiences.
 */
function shouldHideTabBar(pathname: string): boolean {
  return HIDDEN_TAB_BAR_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
}

/**
 * Main application shell that wraps all pages.
 * Provides a flex column layout with bottom tab bar navigation.
 * The tab bar is conditionally hidden on full-screen routes
 * (active workout, settings).
 */
export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideTabBar = shouldHideTabBar(pathname);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className={['flex-1', hideTabBar ? '' : 'pb-20'].filter(Boolean).join(' ')}>
        {children}
      </main>
      {hideTabBar ? null : <BottomTabBar />}
    </div>
  );
}
