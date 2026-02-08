'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft, Save, AlertCircle, Loader2 } from 'lucide-react';
import { AppShell, Header } from '@/components/layout';
import { Button, useToastStore, EmptyState } from '@/components/ui';
import { WorkoutEditor, buildNameMapFromBlocks } from '@/components/workout';
import { db } from '@/lib/db';
import type { TemplateBlock } from '@/types/workout';
import type { ExerciseNameMap } from '@/components/workout';

/** Data resolved from the template, ready to pass into WorkoutEditor. */
interface ResolvedData {
  name: string;
  blocks: TemplateBlock[];
  nameMap: ExerciseNameMap;
}

/**
 * Thin wrapper page for editing an existing workout template.
 * Loads the template from IndexedDB, resolves exercise names,
 * then delegates all editing logic to WorkoutEditor.
 */
export default function EditPage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;
  const addToast = useToastStore((s) => s.addToast);

  const template = useLiveQuery(
    () => db.templates.get(templateId),
    [templateId],
  );

  // Track initialization without synchronous setState in effects.
  // The ref prevents re-running the async resolution; the state
  // holds the resolved initial data once ready.
  const initStartedRef = useRef(false);
  const [resolvedData, setResolvedData] = useState<ResolvedData | null>(null);

  useEffect(() => {
    if (!template || initStartedRef.current) return;
    initStartedRef.current = true;

    buildNameMapFromBlocks(template.blocks)
      .then((map) => {
        setResolvedData({
          name: template.name,
          blocks: template.blocks,
          nameMap: map,
        });
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : 'Failed to load exercise names';
        addToast(message, 'error');
        // Still show editor with empty name map so it is usable
        setResolvedData({
          name: template.name,
          blocks: template.blocks,
          nameMap: {},
        });
      });
  }, [template, addToast]);

  const handleSave = useCallback(
    async (data: {
      name: string;
      blocks: TemplateBlock[];
      nameMap: ExerciseNameMap;
      resolvedBlocks: TemplateBlock[];
    }) => {
      await db.templates.update(templateId, {
        name: data.name,
        blocks: data.resolvedBlocks,
        updatedAt: new Date().toISOString(),
      });

      addToast('Workout updated!', 'success');
      router.push('/');
    },
    [templateId, addToast, router],
  );

  // --- Loading / not-found / ready branching ---

  if (resolvedData) {
    return (
      <WorkoutEditor
        mode="edit"
        title="Edit Workout"
        initialName={resolvedData.name}
        initialBlocks={resolvedData.blocks}
        initialNameMap={resolvedData.nameMap}
        onSave={handleSave}
        saveButtonLabel="Update Workout"
        saveButtonIcon={<Save className="h-5 w-5" />}
      />
    );
  }

  // template is null/undefined after useLiveQuery finished and we never resolved
  // (i.e. template was not found in DB)
  if (template === null) {
    return (
      <EditPageShell router={router}>
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="Workout not found"
          description="This workout template may have been deleted."
          action={
            <Button variant="secondary" onClick={() => router.push('/')}>
              Back to Home
            </Button>
          }
        />
      </EditPageShell>
    );
  }

  // Still loading
  return (
    <EditPageShell router={router}>
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    </EditPageShell>
  );
}

/** Shared shell with header for loading/error states. */
function EditPageShell({
  router,
  children,
}: {
  router: ReturnType<typeof useRouter>;
  children: React.ReactNode;
}) {
  return (
    <AppShell>
      <Header
        title="Edit Workout"
        centered
        leftAction={
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />
      {children}
    </AppShell>
  );
}
