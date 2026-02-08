'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Dumbbell, PlusCircle, BarChart2, TrendingUp } from 'lucide-react';
import { type ComponentType } from 'react';

interface Tab {
  readonly href: string;
  readonly label: string;
  readonly icon: ComponentType<{ className?: string }>;
}

export const tabs: readonly Tab[] = [
  { href: '/', label: 'Workouts', icon: Dumbbell },
  { href: '/create', label: 'Create', icon: PlusCircle },
  { href: '/progress', label: 'Progress', icon: TrendingUp },
  { href: '/history', label: 'History', icon: BarChart2 },
] as const;

/**
 * Determines whether a tab should be marked active based on the current pathname.
 * The root tab ('/') uses exact matching; all others use prefix matching.
 */
function isTabActive(tabHref: string, pathname: string): boolean {
  if (tabHref === '/') {
    return pathname === '/';
  }
  return pathname.startsWith(tabHref);
}

/**
 * Fixed bottom navigation bar with 4 tabs: Workouts, Create, Progress, History.
 * Includes safe-area padding for notched devices.
 */
export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around pb-1 pt-5">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-sfx="tab"
              aria-current={active ? 'page' : undefined}
              aria-label={tab.label}
              className={[
                'relative flex flex-1 flex-col items-center justify-center gap-1',
                'min-h-[48px]',
                'transition-all duration-200',
                active ? 'text-accent scale-105' : 'text-text-muted active:scale-95',
                active ? 'tab-active-glow' : '',
              ].join(' ')}
            >
              <Icon className="h-5 w-5" />
              <span
                className={[
                  'text-[11px]',
                  active ? 'font-semibold' : 'font-medium',
                ].join(' ')}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
