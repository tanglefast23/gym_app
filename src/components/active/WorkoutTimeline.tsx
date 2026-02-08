'use client';

import { useMemo } from 'react';
import type { WorkoutStep } from '@/types/workout';

/* ── Types ─────────────────────────────────────────────────────────── */

interface TimelineNode {
  label: string;
  /** 1-based block number (used for color cycling). */
  blockNumber: number;
  /** All step-array indices that map to this node (multiple for supersets). */
  stepIndices: number[];
}

/* ── Color palette ─────────────────────────────────────────────────── */

/** Pastel palette that cycles per block number. */
const BLOCK_COLORS = [
  { bg: '#F59E0B', bgFaded: 'rgba(245,158,11,0.30)', ring: 'rgba(245,158,11,0.40)', text: '#F59E0B' },  // 1 — amber (accent)
  { bg: '#7DD3FC', bgFaded: 'rgba(125,211,252,0.30)', ring: 'rgba(125,211,252,0.40)', text: '#7DD3FC' },  // 2 — pastel blue
  { bg: '#FCA5A5', bgFaded: 'rgba(252,165,165,0.30)', ring: 'rgba(252,165,165,0.40)', text: '#FCA5A5' },  // 3 — pastel red
  { bg: '#FDE68A', bgFaded: 'rgba(253,230,138,0.30)', ring: 'rgba(253,230,138,0.40)', text: '#FDE68A' },  // 4 — pastel yellow
  { bg: '#86EFAC', bgFaded: 'rgba(134,239,172,0.30)', ring: 'rgba(134,239,172,0.40)', text: '#86EFAC' },  // 5 — pastel green
  { bg: '#D8B4FE', bgFaded: 'rgba(216,180,254,0.30)', ring: 'rgba(216,180,254,0.40)', text: '#D8B4FE' },  // 6 — pastel purple
] as const;

function getBlockColor(blockNumber: number) {
  return BLOCK_COLORS[(blockNumber - 1) % BLOCK_COLORS.length];
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
      nodes.push({
        label: `${blockNum}${letter}`,
        blockNumber: blockNum,
        stepIndices: [i],
      });
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
        const color = getBlockColor(node.blockNumber);

        // Line color: use the color of the node it leads INTO
        const lineColor = upcoming ? undefined : color.bg;

        return (
          <div key={node.label} className="flex items-center">
            {/* Connecting line between nodes */}
            {idx > 0 ? (
              <div
                className="h-[2px] w-[25px]"
                style={{
                  backgroundColor: upcoming ? 'var(--border-color)' : lineColor,
                }}
              />
            ) : null}

            {/* Node circle with label */}
            <div
              className={[
                'flex h-[48px] min-w-[48px] items-center justify-center rounded-full px-2 text-[19px] font-bold leading-none',
                upcoming ? 'border border-border text-text-muted' : '',
              ].join(' ')}
              style={
                current
                  ? {
                      backgroundColor: color.bg,
                      color: 'var(--background)',
                      boxShadow: `0 0 0 2px var(--background), 0 0 0 4px ${color.ring}`,
                    }
                  : completed
                    ? { backgroundColor: color.bgFaded, color: color.text }
                    : undefined
              }
            >
              {node.label}
            </div>
          </div>
        );
      })}
    </div>
  );
};
