'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Search, Play, Pencil, Copy, Trash2, ArrowRight, Settings } from 'lucide-react';
import { db } from '@/lib/db';
import { VALIDATION } from '@/types/workout';
import type { WorkoutTemplate, CrashRecoveryData } from '@/types/workout';
import { AppShell, Header } from '@/components/layout';
import {
  Button,
  BottomSheet,
  ToastContainer,
  useToastStore,
  EmptyState,
  ConfirmDialog,
} from '@/components/ui';
import { WorkoutCard } from '@/components/workout';
import Link from 'next/link';

/** Minimum number of templates before the search bar is shown. */
const SEARCH_THRESHOLD = 5;

interface LogSummary {
  templateId: string | null;
  startedAt: string;
}

function buildLastPerformedMap(
  logs: LogSummary[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const log of logs) {
    if (!log.templateId) continue;
    const existing = map.get(log.templateId);
    if (!existing || log.startedAt > existing) {
      map.set(log.templateId, log.startedAt);
    }
  }

  return map;
}

/**
 * Checks if a recovery record is still valid (less than 4 hours old).
 */
function isRecoveryValid(
  recovery: CrashRecoveryData | undefined,
): recovery is CrashRecoveryData {
  if (!recovery) return false;
  const age = Date.now() - new Date(recovery.savedAt).getTime();
  return age < VALIDATION.RECOVERY_MAX_AGE_MS;
}

/**
 * Continue Session Banner - shown when a crash recovery record exists.
 */
function ContinueBanner({
  recovery,
  onResume,
  onDismiss,
}: {
  recovery: CrashRecoveryData;
  onResume: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mb-4 space-y-3 animate-fade-in-up">
      <button
        type="button"
        onClick={onResume}
        className="flex w-full items-center justify-between rounded-2xl bg-gradient-to-b from-[#4F46E5] to-[#6366F1] p-4 shadow-[0_0_20px_rgba(99,102,241,0.3)] transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div>
          <p className="text-base font-semibold text-white">
            Continue workout
          </p>
          <p className="text-[13px] text-white/70">
            {recovery.templateName}
          </p>
        </div>
        <ArrowRight className="h-5 w-5 flex-shrink-0 text-white" />
      </button>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-[44px] px-2 text-sm text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-lg"
      >
        Dismiss
      </button>
    </div>
  );
}

/**
 * Search bar for filtering templates.
 */
function SearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative mb-4">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
      <input
        type="text"
        placeholder="Search workouts..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search workouts"
        className="h-10 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
      />
    </div>
  );
}

/**
 * Bottom sheet action row used in the template actions sheet.
 */
function ActionRow({
  icon,
  label,
  onClick,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'flex w-full items-center gap-3 rounded-xl px-3 py-3',
        'text-left text-sm font-medium',
        'transition-all duration-150 hover:bg-surface active:bg-surface active:scale-[0.98] hover:translate-x-1',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-elevated',
        className,
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/**
 * Handles duplicating a workout template.
 */
async function duplicateTemplate(template: WorkoutTemplate): Promise<void> {
  const now = new Date().toISOString();
  const newTemplate: WorkoutTemplate = {
    ...template,
    id: crypto.randomUUID(),
    name: `${template.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
  };
  await db.templates.add(newTemplate);
}

export default function HomePage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  // -- State --
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkoutTemplate | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // -- Queries --
  const recovery = useLiveQuery(
    () => db.crashRecovery.get('recovery'),
    [],
  );

  const allTemplates = useLiveQuery(
    () =>
      db.templates
        .filter((t) => !t.isArchived)
        .toArray()
        .then((templates) =>
          templates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        ),
    [],
  );

  const allLogs = useLiveQuery(
    () =>
      db.logs
        .orderBy('startedAt')
        .reverse()
        .limit(50)
        .toArray((logs) =>
          logs.map((l) => ({ templateId: l.templateId, startedAt: l.startedAt })),
        ),
    [],
  );

  const allExercises = useLiveQuery(
    () => db.exercises.toArray(),
    [],
  );

  // -- Derived data --
  const exerciseNameMap = useMemo(() => {
    if (!allExercises) return new Map<string, string>();
    return new Map(allExercises.map((e) => [e.id, e.name]));
  }, [allExercises]);

  const lastPerformedMap = useMemo(
    () => buildLastPerformedMap(allLogs ?? []),
    [allLogs],
  );

  const filteredTemplates = useMemo(() => {
    if (!allTemplates) return undefined;
    if (!searchQuery.trim()) return allTemplates;

    const query = searchQuery.toLowerCase().trim();
    return allTemplates.filter((t) =>
      t.name.toLowerCase().includes(query),
    );
  }, [allTemplates, searchQuery]);

  const showSearch =
    allTemplates !== undefined && allTemplates.length >= SEARCH_THRESHOLD;
  const validRecovery = isRecoveryValid(recovery) ? recovery : null;
  const isLoading =
    allTemplates === undefined || allLogs === undefined;

  // -- Handlers --
  const handleResume = useCallback(() => {
    if (!validRecovery) return;
    router.push(`/workout/${validRecovery.templateId}`);
  }, [validRecovery, router]);

  const handleDismiss = useCallback(async () => {
    try {
      await db.crashRecovery.delete('recovery');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to dismiss recovery';
      addToast(message, 'error');
    }
  }, [addToast]);

  const handleCardClick = useCallback((template: WorkoutTemplate) => {
    setSelectedTemplate(template);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  const handleStartWorkout = useCallback(() => {
    if (!selectedTemplate) return;
    router.push(`/workout/${selectedTemplate.id}`);
    setSelectedTemplate(null);
  }, [selectedTemplate, router]);

  const handleEdit = useCallback(() => {
    if (!selectedTemplate) return;
    router.push(`/edit/${selectedTemplate.id}`);
    setSelectedTemplate(null);
  }, [selectedTemplate, router]);

  const handleDuplicate = useCallback(async () => {
    if (!selectedTemplate) return;
    try {
      await duplicateTemplate(selectedTemplate);
      addToast('Workout duplicated', 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to duplicate workout';
      addToast(message, 'error');
    }
    setSelectedTemplate(null);
  }, [selectedTemplate, addToast]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!selectedTemplate) return;
    try {
      await db.templates.delete(selectedTemplate.id);
      addToast('Workout deleted', 'success');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to delete workout';
      addToast(message, 'error');
    }
    setShowDeleteConfirm(false);
    setSelectedTemplate(null);
  }, [selectedTemplate, addToast]);

  const handleDeleteCancel = useCallback(() => {
    setShowDeleteConfirm(false);
  }, []);

  return (
    <AppShell>
      <ToastContainer />
      <Header
        title="Workouts"
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
        {/* Continue Session Banner */}
        {validRecovery ? (
          <ContinueBanner
            recovery={validRecovery}
            onResume={handleResume}
            onDismiss={handleDismiss}
          />
        ) : null}

        {/* Search Bar */}
        {showSearch ? (
          <SearchBar value={searchQuery} onChange={setSearchQuery} />
        ) : null}

        {/* Loading State */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12" role="status" aria-label="Loading">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : null}

        {/* Empty State */}
        {!isLoading && allTemplates.length === 0 ? (
          <EmptyState
            illustrationSrc="/visuals/empty/empty-workouts.svg"
            illustrationAlt=""
            title="No workouts yet"
            description="Create your first workout template to get started"
            action={
              <Link href="/create">
                <Button variant="primary" size="lg">
                  Create Workout
                </Button>
              </Link>
            }
          />
        ) : null}

        {/* Workout Cards */}
        {!isLoading && filteredTemplates && filteredTemplates.length > 0 ? (
          <div className="space-y-3">
            {filteredTemplates.map((template, i) => (
              <div
                key={template.id}
                className={`animate-fade-in-up stagger-${Math.min(i + 1, 8)}`}
              >
                <WorkoutCard
                  template={template}
                  lastPerformed={lastPerformedMap.get(template.id) ?? null}
                  exerciseNameMap={exerciseNameMap}
                  onClick={() => handleCardClick(template)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {/* No search results */}
        {!isLoading &&
        searchQuery.trim() &&
        filteredTemplates &&
        filteredTemplates.length === 0 &&
        allTemplates.length > 0 ? (
          <EmptyState
            illustrationSrc="/visuals/empty/empty-search.svg"
            illustrationAlt=""
            title="No results"
            description={`No workouts match "${searchQuery.trim()}"`}
          />
        ) : null}
      </div>

      {/* Bottom Sheet - Template Actions */}
      <BottomSheet
        isOpen={selectedTemplate !== null}
        onClose={handleCloseSheet}
        title={selectedTemplate?.name}
      >
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleStartWorkout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-4 text-left text-lg font-bold text-accent transition-colors hover:bg-surface active:bg-surface"
          >
            <Play className="h-8 w-8 text-accent" fill="currentColor" />
            <span>Start Workout</span>
          </button>
          <ActionRow
            icon={<Pencil className="h-5 w-5 text-text-secondary" />}
            label="Edit"
            onClick={handleEdit}
          />
          <ActionRow
            icon={<Copy className="h-5 w-5 text-text-secondary" />}
            label="Duplicate"
            onClick={handleDuplicate}
          />
          <ActionRow
            icon={<Trash2 className="h-5 w-5 text-danger" />}
            label="Delete"
            onClick={handleDeleteClick}
            className="text-danger"
          />
        </div>
      </BottomSheet>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Delete workout?"
        description={`"${selectedTemplate?.name ?? ''}" will be permanently deleted. This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
      />
    </AppShell>
  );
}
