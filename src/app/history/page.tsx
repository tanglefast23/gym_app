'use client';

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Settings, CalendarDays, History as HistoryIcon } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { deleteLog } from '@/lib/queries';
import { hexToRgba, pastelForWorkoutType } from '@/lib/workoutTypeColors';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { BottomSheet, EmptyState, ConfirmDialog, useToastStore } from '@/components/ui';
import { LogCard } from '@/components/history/LogCard';
import type { WorkoutLog } from '@/types/workout';

const groupDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

const monthLabelFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
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

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function segmentedBackground(colors: string[]): React.CSSProperties {
  if (colors.length === 0) return {};
  if (colors.length === 1) return { backgroundColor: colors[0] };

  const n = colors.length;
  const stops: string[] = [];
  for (let i = 0; i < n; i++) {
    const from = (i / n) * 100;
    const to = ((i + 1) / n) * 100;
    stops.push(`${colors[i]} ${from}% ${to}%`);
  }
  return { backgroundImage: `linear-gradient(90deg, ${stops.join(', ')})` };
}

function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

function buildLogsByDay(
  logs: WorkoutLog[],
): Map<string, WorkoutLog[]> {
  const m = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const d = new Date(log.startedAt);
    const key = localDateKey(d);
    const existing = m.get(key);
    if (existing) existing.push(log);
    else m.set(key, [log]);
  }

  for (const arr of m.values()) {
    arr.sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  }

  return m;
}

type MonthOption = {
  key: string; // YYYY-MM
  year: number;
  monthIndex: number; // 0-11
};

function getMonthsWithLogs(logs: WorkoutLog[]): MonthOption[] {
  const seen = new Map<string, MonthOption>();
  for (const log of logs) {
    const d = new Date(log.startedAt);
    const key = localMonthKey(d);
    if (!seen.has(key)) {
      seen.set(key, { key, year: d.getFullYear(), monthIndex: d.getMonth() });
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.key.localeCompare(a.key));
}

function weekdayHeaders(): string[] {
  // Sunday-first calendar (common on iOS in en-US locale).
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

type DaySelection =
  | { dateKey: string; logs: WorkoutLog[] }
  | null;

export default function HistoryPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'history' | 'calendar'>('history');
  const [templateFilters, setTemplateFilters] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<WorkoutLog | null>(null);
  const [selectedMonthKey, setSelectedMonthKey] = useState<string | null>(null);
  const [daySelection, setDaySelection] = useState<DaySelection>(null);
  const addToast = useToastStore((s) => s.addToast);

  // -- Queries --
  const allLogs = useLiveQuery(
    () => db.logs.orderBy('startedAt').reverse().toArray(),
    [],
  );

  // -- Derived data --
  const logsByDay = useMemo(() => buildLogsByDay(allLogs ?? []), [allLogs]);
  const monthOptions = useMemo(
    () => getMonthsWithLogs(allLogs ?? []),
    [allLogs],
  );

  const workoutTypeOptions = useMemo(() => {
    const logs = allLogs ?? [];
    const counts = new Map<string, { count: number; lastAt: string }>();

    for (const log of logs) {
      const name = log.templateName;
      const existing = counts.get(name);
      if (existing) {
        existing.count += 1;
        if (log.startedAt > existing.lastAt) existing.lastAt = log.startedAt;
      } else {
        counts.set(name, { count: 1, lastAt: log.startedAt });
      }
    }

    return Array.from(counts.entries())
      .map(([name, meta]) => ({ name, ...meta, color: pastelForWorkoutType(name) }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        if (b.lastAt !== a.lastAt) return b.lastAt.localeCompare(a.lastAt);
        return a.name.localeCompare(b.name);
      });
  }, [allLogs]);

  const resolvedMonthKey = useMemo(() => {
    if (selectedMonthKey) return selectedMonthKey;
    return monthOptions[0]?.key ?? localMonthKey(new Date());
  }, [selectedMonthKey, monthOptions]);

  const selectedMonth = useMemo(() => {
    const fromOptions = monthOptions.find((m) => m.key === resolvedMonthKey);
    if (fromOptions) return fromOptions;
    const [y, mo] = resolvedMonthKey.split('-').map((v) => Number(v));
    const year = Number.isFinite(y) ? y : new Date().getFullYear();
    const monthIndex = Number.isFinite(mo) ? Math.max(1, Math.min(12, mo)) - 1 : new Date().getMonth();
    return { key: resolvedMonthKey, year, monthIndex };
  }, [monthOptions, resolvedMonthKey]);

  const filteredLogs = useMemo(() => {
    if (!allLogs) return undefined;
    if (templateFilters.length === 0) return allLogs;
    const set = new Set(templateFilters);
    return allLogs.filter((log) => set.has(log.templateName));
  }, [allLogs, templateFilters]);

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

  const handleDayClick = useCallback(
    (dateKey: string) => {
      const logs = logsByDay.get(dateKey) ?? [];
      if (logs.length === 0) return;
      if (logs.length === 1) {
        router.push(`/history/${logs[0]!.id}`);
        return;
      }
      setDaySelection({ dateKey, logs });
    },
    [logsByDay, router],
  );

  const closeDaySelection = useCallback(() => {
    setDaySelection(null);
  }, []);

  const toggleTemplateFilter = useCallback((name: string) => {
    setTemplateFilters((prev) => {
      if (prev.includes(name)) return prev.filter((x) => x !== name);
      return [...prev, name];
    });
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
        {/* Tabs */}
        <div
          className="mb-4 grid grid-cols-2 rounded-2xl border border-border bg-surface p-1 shadow-[0_2px_10px_rgba(0,0,0,0.04)]"
          role="tablist"
          aria-label="History view"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'history'}
            onClick={() => setActiveTab('history')}
            className={[
              'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
              activeTab === 'history'
                ? 'bg-accent/20 text-accent shadow-[0_0_0_1px_rgba(245,158,11,0.30)]'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            <HistoryIcon className="h-4 w-4" />
            History
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'calendar'}
            onClick={() => setActiveTab('calendar')}
            className={[
              'flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all',
              activeTab === 'calendar'
                ? 'bg-accent/20 text-accent shadow-[0_0_0_1px_rgba(245,158,11,0.30)]'
                : 'text-text-muted hover:text-text-secondary',
            ].join(' ')}
          >
            <CalendarDays className="h-4 w-4" />
            Calendar
          </button>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : null}

        {!isLoading ? (
          <>
            {activeTab === 'history' ? (
              <>
                {/* Workout-type filter pills (colored to match calendar) */}
                {allLogs.length > 0 ? (
                  <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setTemplateFilters([])}
                      className={[
                        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                        templateFilters.length === 0
                          ? 'border-accent bg-accent/15 text-text-primary'
                          : 'border-border bg-surface text-text-muted hover:text-text-secondary',
                      ].join(' ')}
                    >
                      All
                    </button>
                    {workoutTypeOptions.map((opt) => {
                      const selected = templateFilters.includes(opt.name);
                      return (
                        <button
                          key={opt.name}
                          type="button"
                          onClick={() => toggleTemplateFilter(opt.name)}
                          className={[
                            'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                            selected
                              ? 'text-[#0A0A0B]'
                              : 'text-text-secondary hover:text-text-primary',
                          ].join(' ')}
                          style={
                            selected
                              ? { backgroundColor: opt.color, borderColor: 'rgba(0,0,0,0.08)' }
                              : { backgroundColor: hexToRgba(opt.color, 0.18), borderColor: hexToRgba(opt.color, 0.55) }
                          }
                          aria-pressed={selected}
                        >
                          {opt.name}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {/* Empty state - no logs at all */}
                {allLogs.length === 0 ? (
                  <EmptyState
                    illustrationSrc="/visuals/empty/empty-history.svg"
                    illustrationAlt=""
                    title="No history yet"
                    description="Your first workout is waiting. Finish one and it will show up here."
                  />
                ) : null}

                {/* No filter results */}
                {allLogs.length > 0 &&
                templateFilters.length > 0 &&
                filteredLogs &&
                filteredLogs.length === 0 ? (
                  <EmptyState
                    illustrationSrc="/visuals/empty/empty-search.svg"
                    illustrationAlt=""
                    title="No results"
                    description="No workouts match your selected filters."
                  />
                ) : null}

                {/* Grouped log entries */}
                {groupedLogs.map((group, gi) => (
                  <section key={group.label} className={`mb-4 animate-fade-in-up stagger-${Math.min(gi + 1, 8)}`}>
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
            ) : (
              <>
                {allLogs.length === 0 ? (
                  <EmptyState
                    illustrationSrc="/visuals/empty/empty-history.svg"
                    illustrationAlt=""
                    title="No workouts yet"
                    description="Complete a workout and it will appear on your calendar."
                  />
                ) : (
                  <div className="animate-fade-in-up">
                    {/* Month selector */}
                    <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                      {monthOptions.map((m) => {
                        const label = monthLabelFormatter.format(new Date(m.year, m.monthIndex, 1));
                        const active = m.key === selectedMonth.key;
                        return (
                          <button
                            key={m.key}
                            type="button"
                            onClick={() => setSelectedMonthKey(m.key)}
                            className={[
                              'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                              active
                                ? 'border-accent bg-accent/15 text-text-primary'
                                : 'border-border bg-surface text-text-muted hover:text-text-secondary',
                            ].join(' ')}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Calendar grid */}
                    <div className="rounded-2xl border border-border bg-surface p-4">
                      <div className="mb-3 flex items-baseline justify-between">
                        <h3 className="text-sm font-semibold text-text-primary">
                          {monthLabelFormatter.format(new Date(selectedMonth.year, selectedMonth.monthIndex, 1))}
                        </h3>
                        <p className="text-xs text-text-muted">
                          Tap a colored day to view workouts
                        </p>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {weekdayHeaders().map((d) => (
                          <div
                            key={d}
                            className="text-center text-[11px] font-semibold text-text-muted"
                          >
                            {d}
                          </div>
                        ))}

                        {(() => {
                          const first = new Date(selectedMonth.year, selectedMonth.monthIndex, 1);
                          const offset = first.getDay(); // Sunday-first
                          const totalDays = daysInMonth(selectedMonth.year, selectedMonth.monthIndex);
                          const cells: React.JSX.Element[] = [];

                          for (let i = 0; i < offset; i++) {
                            cells.push(<div key={`blank-${i}`} />);
                          }

                          for (let day = 1; day <= totalDays; day++) {
                            const d = new Date(selectedMonth.year, selectedMonth.monthIndex, day);
                            const dateKey = localDateKey(d);
                            const logs = logsByDay.get(dateKey) ?? [];
                            const count = logs.length;
                            const hasWorkout = count > 0;
                            // Split the day cell by workout sessions:
                            // 1 session = solid color, 2 = halves, 3 = thirds.
                            // If more than 3 sessions exist, we still show the first 3 colors.
                            const segmentColors = hasWorkout
                              ? logs.slice(0, 3).map((l) => pastelForWorkoutType(l.templateName))
                              : [];

                            cells.push(
                              <button
                                key={dateKey}
                                type="button"
                                onClick={() => handleDayClick(dateKey)}
                                disabled={!hasWorkout}
                                aria-label={
                                  hasWorkout
                                    ? `${count} workout${count === 1 ? '' : 's'} on ${d.toDateString()}`
                                    : `No workouts on ${d.toDateString()}`
                                }
                                style={hasWorkout ? segmentedBackground(segmentColors) : undefined}
                                className={[
                                  'h-10 rounded-xl border text-sm font-semibold tabular-nums transition-transform',
                                  'active:scale-[0.97]',
                                  hasWorkout
                                    ? 'border-black/10 text-[#0A0A0B] hover:brightness-110'
                                    : 'border-border bg-transparent text-text-muted opacity-70',
                                ].join(' ')}
                              >
                                {day}
                              </button>,
                            );
                          }

                          return cells;
                        })()}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
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

      <BottomSheet
        isOpen={daySelection !== null}
        onClose={closeDaySelection}
        title={daySelection ? `Workouts on ${daySelection.dateKey}` : undefined}
      >
        {daySelection ? (
          <div className="flex flex-col gap-2">
            {daySelection.logs.map((log) => {
              const t = new Date(log.startedAt);
              const timeLabel = t.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
              return (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => {
                    closeDaySelection();
                    router.push(`/history/${log.id}`);
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-border bg-surface px-4 py-3 text-left transition-colors hover:bg-elevated active:bg-elevated"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">
                      {log.templateName}
                    </p>
                    <p className="text-xs text-text-muted">{timeLabel}</p>
                  </div>
                  <span className="text-xs font-semibold text-accent">View</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </BottomSheet>
    </AppShell>
  );
}
