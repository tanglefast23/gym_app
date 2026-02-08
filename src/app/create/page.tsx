'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { useToastStore } from '@/components/ui';
import { WorkoutEditor } from '@/components/workout';
import { db } from '@/lib/db';
import type { TemplateBlock } from '@/types/workout';
import type { ExerciseNameMap } from '@/components/workout';

export default function CreatePage() {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);

  const handleSave = useCallback(
    async (data: {
      name: string;
      blocks: TemplateBlock[];
      nameMap: ExerciseNameMap;
      resolvedBlocks: TemplateBlock[];
    }) => {
      const now = new Date().toISOString();

      await db.templates.add({
        id: crypto.randomUUID(),
        name: data.name,
        blocks: data.resolvedBlocks,
        defaultRestBetweenSetsSec: null,
        createdAt: now,
        updatedAt: now,
        isArchived: false,
      });

      addToast('Workout created!', 'success');
      router.push('/');
    },
    [addToast, router],
  );

  return (
    <WorkoutEditor
      mode="create"
      title="Create Workout"
      onSave={handleSave}
      saveButtonLabel="Save Workout"
      saveButtonIcon={<Plus className="h-5 w-5" />}
    />
  );
}
