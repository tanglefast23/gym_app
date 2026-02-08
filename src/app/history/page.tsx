'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Search, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { ACHIEVEMENTS } from '@/lib/achievements';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui';
import { LogCard } from '@/components/history/LogCard';
import { AchievementCard } from '@/components/history/AchievementCard';
import type { WorkoutLog, UnlockedAchievement } from '@/types/workout';

const groupDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

function groupLogsByDate(
  logs: WorkoutLog[],
): Array<{ label: string; logs: WorkoutLog[] }> {
  const groups = new Map<string, WorkoutLog[]>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayKey = today.toDateString();
  const yesterdayKey = yesterday.toDateString();

  for (const log of logs) {
    const logDate = new Date(log.startedAt);
    const dateKey = logDate.toDateString();

    let label: string;
    if (dateKey === todayKey) {
      label = 'Today';
    } else if (dateKey === yesterdayKey) {
      label = 'Yesterday';
    } else {
      label = groupDateFormatter.format(logDate);
    }

    const existing = groups.get(label);
    if (existing) {
      existing.push(log);
    } else {
      groups.set(label, [log]);
    }
  }

  return Array.from(groups.entries()).map(([label, groupLogs]) => ({
    label,
    logs: groupLogs,
  }));
}

/**
 * Builds a lookup map from achievement ID to its unlocked data.
 */
function buildUnlockedMap(
  unlocked: UnlockedAchievement[],
): Map<string, UnlockedAchievement> {
  const map = new Map<string, UnlockedAchievement>();
  for (const a of unlocked) {
    map.set(a.achievementId, a);
  }
  return map;
}

export default function HistoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');

  // -- Queries --
  const allLogs = useLiveQuery(
    () => db.logs.orderBy('startedAt').reverse().toArray(),
    [],
  );

  const unlockedAchievements = useLiveQuery(
    () => db.achievements.toArray(),
    [],
  );

  // -- Derived data --
  const unlockedMap = useMemo(
    () => buildUnlockedMap(unlockedAchievements ?? []),
    [unlockedAchievements],
  );

  const filteredLogs = useMemo(() => {
    if (!allLogs) return undefined;
    if (!searchQuery.trim()) return allLogs;

    const query = searchQuery.toLowerCase().trim();
    return allLogs.filter((log) =>
      log.templateName.toLowerCase().includes(query),
    );
  }, [allLogs, searchQuery]);

  const groupedLogs = useMemo(
    () => groupLogsByDate(filteredLogs ?? []),
    [filteredLogs],
  );

  const isLoading =
    allLogs === undefined || unlockedAchievements === undefined;

  // -- Handlers --
  const handleLogClick = useCallback(
    (logId: string) => {
      router.push(`/history/${logId}`);
    },
    [router],
  );

  return (
    <AppShell>
      <Header
        title="History"
        rightAction={
          <Link
            href="/settings"
            aria-label="Settings"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-elevated"
          >
            <Settings className="h-5 w-5 text-text-secondary" />
          </Link>
        }
      />

      <div className="px-5 pt-4">
        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : null}

        {!isLoading ? (
          <>
            {/* Achievements Section */}
            <section className="mb-6">
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                ACHIEVEMENTS
              </h2>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
                {ACHIEVEMENTS.map((def) => {
                  const unlocked = unlockedMap.get(def.id);
                  return (
                    <AchievementCard
                      key={def.id}
                      icon={def.icon}
                      name={def.name}
                      description={def.description}
                      isUnlocked={!!unlocked}
                      unlockedAt={unlocked?.unlockedAt}
                      context={unlocked?.context}
                    />
                  );
                })}
              </div>
            </section>

            {/* Search Filter */}
            {allLogs.length > 0 ? (
              <div className="relative mb-4">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Search workouts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            ) : null}

            {/* Empty state - no logs at all */}
            {allLogs.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-12 w-12" />}
                title="No workouts yet"
                description="Complete your first workout to see your history here"
              />
            ) : null}

            {/* No search results */}
            {allLogs.length > 0 &&
            searchQuery.trim() &&
            filteredLogs &&
            filteredLogs.length === 0 ? (
              <EmptyState
                icon={<Search className="h-12 w-12" />}
                title="No results"
                description={`No workouts match "${searchQuery.trim()}"`}
              />
            ) : null}

            {/* Grouped log entries */}
            {groupedLogs.map((group) => (
              <section key={group.label} className="mb-4">
                <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
                  {group.label}
                </h3>
                {group.logs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    onClick={() => handleLogClick(log.id)}
                  />
                ))}
              </section>
            ))}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
