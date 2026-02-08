'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, Search } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { deleteLog } from '@/lib/queries';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { EmptyState, ConfirmDialog, useToastStore } from '@/components/ui';
import { LogCard } from '@/components/history/LogCard';
import type { WorkoutLog } from '@/types/workout';

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

export default function HistoryPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WorkoutLog | null>(null);
  const addToast = useToastStore((s) => s.addToast);

  // -- Queries --
  const allLogs = useLiveQuery(
    () => db.logs.orderBy('startedAt').reverse().toArray(),
    [],
  );

  // -- Derived data --
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

  const isLoading = allLogs === undefined;

  // -- Handlers --
  const handleLogClick = useCallback(
    (logId: string) => {
      router.push(`/history/${logId}`);
    },
    [router],
  );

  const handleLongPress = useCallback((log: WorkoutLog) => {
    setDeleteTarget(log);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteLog(deleteTarget.id);
      addToast('Session deleted', 'success');
    } catch {
      addToast('Failed to delete session', 'error');
    }
    setDeleteTarget(null);
  }, [deleteTarget, addToast]);

  const handleDeleteClose = useCallback(() => {
    setDeleteTarget(null);
  }, []);

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
                illustrationSrc="/visuals/empty/empty-history.svg"
                illustrationAlt=""
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
                illustrationSrc="/visuals/empty/empty-search.svg"
                illustrationAlt=""
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
                    onLongPress={() => handleLongPress(log)}
                  />
                ))}
              </section>
            ))}
          </>
        ) : null}
      </div>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
        title="Delete session?"
        description={`Are you sure you want to delete "${deleteTarget?.templateName ?? ''}"? This cannot be undone.`}
        confirmText="Yes"
        variant="danger"
      />
    </AppShell>
  );
}
