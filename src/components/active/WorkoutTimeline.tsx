'use client';

import { useMemo } from 'react';
import type { WorkoutStep } from '@/types/workout';

/* ── Types ─────────────────────────────────────────────────────────── */

interface TimelineNode {
  label: string;
  /** All step-array indices that map to this node (multiple for supersets). */
  stepIndices: number[];
}

/* ── Node computation ──────────────────────────────────────────────── */

/**
 * Collapse exercise steps into timeline nodes grouped by (blockIndex, setIndex).
 * Each unique combination becomes one node labelled "1a", "1b", "2a", etc.
 */
function computeNodes(steps: WorkoutStep[]): TimelineNode[] {
  const nodes: TimelineNode[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (step.type !== 'exercise') continue;

    const key = `${step.blockIndex}-${step.setIndex ?? 0}`;

    if (seen.has(key)) {
      nodes[seen.get(key)!].stepIndices.push(i);
    } else {
      const blockNum = step.blockIndex + 1;
      const letter = String.fromCharCode(97 + (step.setIndex ?? 0));
      nodes.push({ label: `${blockNum}${letter}`, stepIndices: [i] });
      seen.set(key, nodes.length - 1);
    }
  }

  return nodes;
}

/**
 * Find the timeline node that corresponds to the current workout position.
 * Walks backward from currentStepIndex to the most recent exercise step.
 */
function findActiveNodeIndex(
  steps: WorkoutStep[],
  nodes: TimelineNode[],
  currentStepIndex: number,
): number {
  for (let i = Math.min(currentStepIndex, steps.length - 1); i >= 0; i--) {
    if (steps[i].type !== 'exercise') continue;
    for (let n = 0; n < nodes.length; n++) {
      if (nodes[n].stepIndices.includes(i)) return n;
    }
  }
  return 0;
}

/* ── Component ─────────────────────────────────────────────────────── */

interface WorkoutTimelineProps {
  steps: WorkoutStep[];
  currentStepIndex: number;
}

export const WorkoutTimeline = ({
  steps,
  currentStepIndex,
}: WorkoutTimelineProps) => {
  const nodes = useMemo(() => computeNodes(steps), [steps]);
  const activeIdx = useMemo(
    () => findActiveNodeIndex(steps, nodes, currentStepIndex),
    [steps, nodes, currentStepIndex],
  );

  if (nodes.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-y-3 px-6 pb-4 pt-2">
      {nodes.map((node, idx) => {
        const completed = idx < activeIdx;
        const current = idx === activeIdx;
        const upcoming = idx > activeIdx;

        return (
          <div key={node.label} className="flex items-center">
            {/* Connecting line between nodes */}
            {idx > 0 ? (
              <div
                className={[
                  'h-[2px] w-5',
                  upcoming ? 'bg-border' : 'bg-accent',
                ].join(' ')}
              />
            ) : null}

            {/* Node circle with label */}
            <div
              className={[
                'flex h-9 min-w-9 items-center justify-center rounded-full px-1.5 text-xs font-bold leading-none',
                current
                  ? 'bg-accent text-background ring-2 ring-accent/40 ring-offset-1 ring-offset-background'
                  : '',
                completed ? 'bg-accent/30 text-accent' : '',
                upcoming ? 'border border-border text-text-muted' : '',
              ].join(' ')}
            >
              {node.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
