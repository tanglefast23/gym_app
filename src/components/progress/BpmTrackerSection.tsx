'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { Check, HeartPulse, Minus, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { buildBpmChartData, latestBpmPerDay } from '@/lib/bpm';
import { localDateKey } from '@/lib/bodyWeight';
import { playSfx } from '@/lib/sfx';
import { VALIDATION } from '@/types/workout';
import { useSettingsStore } from '@/stores/settingsStore';
import { BpmChart } from '@/components/bpm/BpmChart';
import { TimelinePills } from '@/components/weight/TimelinePills';
import { Button, Card, useToastStore } from '@/components/ui';
import type { BpmEntry } from '@/types/workout';
import type { WeightTimeline } from '@/types/weight';

function focusTodayWeight(): void {
  const el = document.getElementById('today-weight');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.dispatchEvent(new Event('workout-pwa:focus-today-weight'));
}

function MissingInfoNudge({
  missing,
}: {
  missing: {
    age: boolean;
    sex: boolean;
    height: boolean;
    weight: boolean;
  };
}) {
  if (!missing.age && !missing.sex && !missing.height && !missing.weight) return null;

  const parts: React.ReactNode[] = [];
  const pushCommaSeparated = (node: React.ReactNode) => {
    if (parts.length > 0) parts.push(', ');
    parts.push(node);
  };

  if (missing.age) {
    pushCommaSeparated(
      <Link
        key="age"
        href="/settings?focus=age"
        className="font-semibold text-accent underline decoration-dotted underline-offset-2"
      >
        age
      </Link>,
    );
  }
  if (missing.sex) {
    pushCommaSeparated(
      <Link
        key="sex"
        href="/settings?focus=sex"
        className="font-semibold text-accent underline decoration-dotted underline-offset-2"
      >
        sex
      </Link>,
    );
  }
  if (missing.height) {
    pushCommaSeparated(
      <Link
        key="height"
        href="/settings?focus=height"
        className="font-semibold text-accent underline decoration-dotted underline-offset-2"
      >
        height
      </Link>,
    );
  }
  if (missing.weight) {
    pushCommaSeparated(
      <button
        key="weight"
        type="button"
        onClick={focusTodayWeight}
        className="font-semibold text-accent underline decoration-dotted underline-offset-2"
      >
        weight
      </button>,
    );
  }

  return (
    <div className="mb-3 rounded-2xl border border-border bg-elevated/40 p-3 text-xs text-text-muted">
      To show your healthy BPM range, add your {parts}.
    </div>
  );
}

export function BpmTrackerSection() {
  const addToast = useToastStore((s) => s.addToast);

  const age = useSettingsStore((s) => s.age);
  const sex = useSettingsStore((s) => s.sex);
  const heightCm = useSettingsStore((s) => s.heightCm);

  const bpms = useLiveQuery(() => db.bpms.orderBy('recordedAt').toArray(), []);
  const latestWeight = useLiveQuery(
    () => db.bodyWeights.orderBy('recordedAt').last(),
    [],
  );

  const [timeline, setTimeline] = useState<WeightTimeline>('week');
  const [todayDraft, setTodayDraft] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [showLoggedCheck, setShowLoggedCheck] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const bpmInputRef = useRef<HTMLInputElement | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const todayKey = localDateKey(new Date());

  const latestEntry = useMemo(() => {
    const arr = bpms ?? [];
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }, [bpms]);

  const latestByDay = useMemo(() => latestBpmPerDay(bpms ?? []), [bpms]);

  const todaysEntry = useMemo(() => {
    const byKey = new Map(latestByDay.map((x) => [x.dateKey, x.entry]));
    return byKey.get(todayKey) ?? null;
  }, [latestByDay, todayKey]);

  useEffect(() => {
    const base = (todaysEntry ?? latestEntry)?.bpm;
    if (base == null) return;
    if (draftInitialized && !todaysEntry) return;
    if (Number.isFinite(base) && base > 0) {
      setTodayDraft(Math.round(base));
      setDraftInitialized(true);
    }
  }, [todaysEntry, latestEntry, draftInitialized]);

  useEffect(() => {
    return () => {
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);

  const handleAdjustDraft = useCallback(
    (delta: number) => {
      if (showLoggedCheck) setShowLoggedCheck(false);
      setTodayDraft((v) => Math.max(0, Math.round(v + delta)));
    },
    [showLoggedCheck],
  );

  const handleCommitEdit = useCallback((rawValue: string) => {
    setIsEditing(false);
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;
    setTodayDraft(Math.max(0, Math.round(parsed)));
  }, []);

  const handleSubmitToday = useCallback(async () => {
    const value = Math.round(todayDraft);
    if (!Number.isFinite(value) || value <= 0) return;
    if (value < VALIDATION.MIN_BPM || value > VALIDATION.MAX_BPM) {
      addToast(`BPM must be between ${VALIDATION.MIN_BPM} and ${VALIDATION.MAX_BPM}`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const entry: BpmEntry = {
        id: localDateKey(now), // one entry per day; update replaces the same key
        recordedAt: now.toISOString(),
        bpm: value,
      };
      await db.bpms.put(entry);

      playSfx('success');
      setShowLoggedCheck(true);
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      checkTimerRef.current = setTimeout(() => {
        setShowLoggedCheck(false);
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save BPM';
      addToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  }, [todayDraft, addToast]);

  const chartData = useMemo(
    () => buildBpmChartData(bpms ?? [], timeline),
    [bpms, timeline],
  );

  const missing = useMemo(() => {
    return {
      age: age === null,
      sex: sex === null,
      height: heightCm === null,
      weight: !latestWeight,
    };
  }, [age, sex, heightCm, latestWeight]);

  const healthyRange = useMemo(() => {
    if (missing.age || missing.sex || missing.height || missing.weight) return null;
    // TODO: Confirm the personalization formula. For now we show a common adult resting BPM range.
    return { minBpm: 60, maxBpm: 100 };
  }, [missing]);

  const recentEntries = useMemo(() => {
    const byDay = latestBpmPerDay(bpms ?? []);
    const last = byDay.slice(-5).reverse(); // latest first
    return last.map((x, idx) => {
      const prev = last[idx + 1]?.entry ?? null;
      const delta = prev ? x.entry.bpm - prev.bpm : null;
      return { ...x, delta };
    });
  }, [bpms]);

  return (
    <section className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
        <HeartPulse className="h-3.5 w-3.5" />
        BPM TRACKER
      </h2>

      {/* Today's BPM input */}
      <Card padding="md" className="mb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">Today&apos;s BPM</p>
            <p className="text-xs text-text-muted">Resting heart rate (manual entry)</p>
          </div>
          <p className="text-xs text-text-muted">bpm</p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleAdjustDraft(-1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-elevated text-text-primary transition-transform active:scale-[0.97]"
            aria-label="Decrease BPM"
          >
            <Minus className="h-5 w-5" />
          </button>

          {isEditing ? (
            <input
              ref={bpmInputRef}
              type="text"
              inputMode="numeric"
              defaultValue={todayDraft ? String(todayDraft) : ''}
              autoFocus
              onBlur={(e) => handleCommitEdit(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              className="min-w-[7.5rem] rounded-2xl border border-border bg-surface px-4 py-3 text-center font-timer text-4xl text-text-primary outline-none focus:border-accent"
              aria-label="Enter today's BPM"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                if (showLoggedCheck) setShowLoggedCheck(false);
                setIsEditing(true);
              }}
              className="min-w-[7.5rem] rounded-2xl border border-border bg-surface px-4 py-3 text-center font-timer text-4xl text-text-primary"
              aria-label="Edit today's BPM"
            >
              {showLoggedCheck ? (
                <span className="flex flex-col items-center justify-center">
                  <Check className="h-8 w-8 text-success animate-check-pop" />
                  <span className="mt-1 text-xs font-semibold uppercase tracking-[1px] text-text-muted">
                    Logged
                  </span>
                </span>
              ) : (
                todayDraft ? String(todayDraft) : '\u2014'
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleAdjustDraft(1)}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-elevated text-text-primary transition-transform active:scale-[0.97]"
            aria-label="Increase BPM"
          >
            <Plus className="h-5 w-5" />
          </button>

          <Button
            size="sm"
            variant="primary"
            disabled={todayDraft <= 0 || showLoggedCheck}
            loading={isSubmitting}
            data-no-click-sfx="true"
            onClick={() => void handleSubmitToday()}
          >
            Submit
          </Button>
        </div>
      </Card>

      {/* Recent changes + chart */}
      <Card padding="md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">BPM changes</p>
            <p className="text-xs text-text-muted">Last {timeline} view</p>
          </div>
          <div>
            <TimelinePills
              value={timeline}
              onChange={setTimeline}
              ariaLabel="BPM timeline"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-3">
          <MissingInfoNudge missing={missing} />
          <BpmChart data={chartData} healthyRange={healthyRange} height={140} />
        </div>

        {recentEntries.length > 0 ? (
          <div className="mt-4 space-y-2">
            {recentEntries.map(({ dateKey, entry, delta }) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl bg-elevated px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary">{dateKey}</p>
                  <p className="text-[11px] text-text-muted">
                    {new Date(entry.recordedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">{entry.bpm} bpm</p>
                  {delta !== null ? (
                    <p className="text-[11px] text-text-muted">
                      {delta >= 0 ? '+' : ''}
                      {delta} bpm
                    </p>
                  ) : (
                    <p className="text-[11px] text-text-muted">—</p>
                  )}
                </div>
              </div>
            ))}
          </div>
      ) : (
        <p className="mt-4 text-xs text-text-muted">
          No BPM entries yet. Log today&apos;s BPM to start tracking.
        </p>
      )}
    </Card>
    </section>
  );
}
