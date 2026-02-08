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
      role="tablist"
      aria-label="Main navigation"
    >
      <div className="flex items-center justify-around pt-3">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, pathname);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              data-sfx="tab"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              className={[
                'flex flex-1 flex-col items-center justify-center gap-1',
                'transition-colors duration-150',
                active ? 'text-accent' : 'text-text-muted',
              ].join(' ')}
            >
              <Icon className="h-6 w-6" />
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
