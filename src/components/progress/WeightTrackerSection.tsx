'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRouter } from 'next/navigation';
import { Check, Minus, Plus } from 'lucide-react';
import { db } from '@/lib/db';
import { localDateKey, latestPerDay, buildBodyWeightChartData } from '@/lib/bodyWeight';
import { buildBmiChartData, computeBmi } from '@/lib/bmi';
import { displayToGrams, formatWeight, formatWeightValue } from '@/lib/calculations';
import { playSfx } from '@/lib/sfx';
import { useSettingsStore } from '@/stores/settingsStore';
import { ScaleIcon } from '@/components/icons/ScaleIcon';
import { BodyWeightChart } from '@/components/weight/BodyWeightChart';
import { TimelinePills } from '@/components/weight/TimelinePills';
import { BmiChart } from '@/components/bmi/BmiChart';
import { Button, Card, useToastStore } from '@/components/ui';
import type { BodyWeightEntry, UnitSystem } from '@/types/workout';
import type { WeightTimeline } from '@/types/weight';

function focusTodayWeight(): void {
  const el = document.getElementById('today-weight');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  window.dispatchEvent(new Event('workout-pwa:focus-today-weight'));
}

export function WeightTrackerSection({
  unitSystem,
}: {
  unitSystem: UnitSystem;
}) {
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const heightCm = useSettingsStore((s) => s.heightCm);
  const age = useSettingsStore((s) => s.age);
  const sex = useSettingsStore((s) => s.sex);

  const bodyWeights = useLiveQuery(
    () => db.bodyWeights.orderBy('recordedAt').toArray(),
    [],
  );

  const [weightTimeline, setWeightTimeline] = useState<WeightTimeline>('month');
  const [todayDraft, setTodayDraft] = useState<number>(0);
  const [isSubmittingWeight, setIsSubmittingWeight] = useState(false);
  const [draftInitialized, setDraftInitialized] = useState(false);
  const [showLoggedCheck, setShowLoggedCheck] = useState(false);
  const [isEditingWeight, setIsEditingWeight] = useState(false);
  const weightInputRef = useRef<HTMLInputElement | null>(null);
  const [weightLoggedOverlay, setWeightLoggedOverlay] = useState<{
    valueText: string;
    unitText: string;
  } | null>(null);
  const overlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = unitSystem === 'kg' ? 0.1 : 0.5;

  const latestEntry = useMemo(() => {
    const arr = bodyWeights ?? [];
    return arr.length > 0 ? arr[arr.length - 1] : null;
  }, [bodyWeights]);

  // Recomputed each render (important if the app stays open across midnight).
  const todayKey = localDateKey(new Date());

  const latestByDay = useMemo(() => latestPerDay(bodyWeights ?? []), [bodyWeights]);

  const todaysEntry = useMemo(() => {
    const byKey = new Map(latestByDay.map((x) => [x.dateKey, x.entry]));
    return byKey.get(todayKey) ?? null;
  }, [latestByDay, todayKey]);

  // Keep the draft in sync with today's existing entry (and fall back to latest entry).
  useEffect(() => {
    const base = (todaysEntry ?? latestEntry)?.weightG;
    if (base == null) return;
    if (draftInitialized && !todaysEntry) return;
    const v = Number(formatWeightValue(base, unitSystem));
    if (Number.isFinite(v)) {
      setTodayDraft(v);
      setDraftInitialized(true);
    }
  }, [todaysEntry, latestEntry, unitSystem, draftInitialized]);

  useEffect(() => {
    return () => {
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
    };
  }, []);

  // Allow other sections to deep-link into the "Today's weight" editor.
  useEffect(() => {
    const handler = () => {
      setShowLoggedCheck(false);
      setIsEditingWeight(true);
      // Let the input mount before focusing.
      setTimeout(() => weightInputRef.current?.focus(), 0);
    };
    window.addEventListener('workout-pwa:focus-today-weight', handler);
    return () => window.removeEventListener('workout-pwa:focus-today-weight', handler);
  }, []);

  const handleAdjustDraft = useCallback(
    (delta: number) => {
      if (showLoggedCheck) setShowLoggedCheck(false);
      setTodayDraft((v) => {
        const next = Math.max(0, Math.round((v + delta) * 10) / 10);
        return next;
      });
    },
    [showLoggedCheck],
  );

  const handleCommitWeightEdit = useCallback(
    (rawValue: string) => {
      setIsEditingWeight(false);
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) return;
      setTodayDraft(Math.max(0, Math.round(parsed * 10) / 10));
    },
    [],
  );

  const handleSubmitToday = useCallback(async () => {
    const value = todayDraft;
    if (!Number.isFinite(value) || value <= 0) return;

    setIsSubmittingWeight(true);
    try {
      const now = new Date();
      const nowIso = now.toISOString();
      const submitKey = localDateKey(now);

      const entry: BodyWeightEntry = {
        id: submitKey, // one entry per day; update replaces the same key
        recordedAt: nowIso,
        weightG: displayToGrams(value, unitSystem),
      };
      await db.bodyWeights.put(entry);

      // Feedback: level-up sound + big overlay + checkmark in the input box.
      playSfx('success');
      const valueText = value.toFixed(value % 1 === 0 ? 0 : 1);
      const unitText = unitSystem === 'kg' ? 'kg' : 'lbs';

      setShowLoggedCheck(true);
      setWeightLoggedOverlay({ valueText, unitText });

      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      overlayTimerRef.current = setTimeout(() => {
        setWeightLoggedOverlay(null);
      }, 1400);

      if (checkTimerRef.current) clearTimeout(checkTimerRef.current);
      checkTimerRef.current = setTimeout(() => {
        setShowLoggedCheck(false);
      }, 1800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save weight';
      addToast(msg, 'error');
    } finally {
      setIsSubmittingWeight(false);
    }
  }, [todayDraft, unitSystem, addToast]);

  const weightChartData = useMemo(
    () => buildBodyWeightChartData(bodyWeights ?? [], weightTimeline, unitSystem),
    [bodyWeights, weightTimeline, unitSystem],
  );

  const [bmiTimeline, setBmiTimeline] = useState<WeightTimeline>('week');

  const bmiChartData = useMemo(() => {
    if (!heightCm) return null;
    return buildBmiChartData(bodyWeights ?? [], heightCm, bmiTimeline);
  }, [bodyWeights, heightCm, bmiTimeline]);

  const recentEntries = useMemo(() => {
    const byDay = latestPerDay(bodyWeights ?? []);
    const last = byDay.slice(-5).reverse(); // latest first
    return last.map((x, idx) => {
      const prev = last[idx + 1]?.entry ?? null;
      const deltaG = prev ? x.entry.weightG - prev.weightG : null;
      return { ...x, deltaG };
    });
  }, [bodyWeights]);

  const bmiMissing = useMemo(() => {
    return {
      height: heightCm === null,
      weight: (bodyWeights ?? []).length === 0,
      age: age === null,
      sex: sex === null,
    };
  }, [heightCm, bodyWeights, age, sex]);

  const bmiHealthyRange = useMemo(() => {
    // BMI itself requires height + weight.
    if (bmiMissing.height || bmiMissing.weight) return null;
    // Healthy BMI thresholds depend on BMI-for-age percentiles for < 20.
    if (age === null) return null;
    if (age < 20) return null;
    return { min: 18.5, max: 24.9 };
  }, [bmiMissing.height, bmiMissing.weight, age]);

  return (
    <section className="mb-6">
      {/* Weight logged overlay */}
      {weightLoggedOverlay ? (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-background/30 backdrop-blur-[2px]" />
          <div className="relative animate-weight-log-overlay rounded-3xl border border-accent/40 bg-surface/90 px-8 py-7 shadow-[0_20px_80px_rgba(245,158,11,0.22)]">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 text-accent">
              <Check className="h-7 w-7 animate-check-pop" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold uppercase tracking-[1px] text-text-muted">
                Logged
              </p>
              <p className="mt-1 font-timer text-6xl leading-none text-text-primary">
                {weightLoggedOverlay.valueText}
                <span className="ml-2 text-2xl text-text-secondary">
                  {weightLoggedOverlay.unitText}
                </span>
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
        <ScaleIcon className="h-3.5 w-3.5" />
        WEIGHT TRACKER
      </h2>

      {/* Today's weight input */}
      <Card
        id="today-weight"
        padding="md"
        className="mb-3"
        onClick={() => router.push('/weight')}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Today&apos;s weight
            </p>
            <p className="text-xs text-text-muted">
              Tap to view full history
            </p>
          </div>
          <p className="text-xs text-text-muted">
            {unitSystem === 'kg' ? 'kg' : 'lbs'}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAdjustDraft(-step);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-elevated text-text-primary transition-transform active:scale-[0.97]"
            aria-label="Decrease body weight"
          >
            <Minus className="h-5 w-5" />
          </button>

          {isEditingWeight ? (
            <input
              ref={weightInputRef}
              type="text"
              inputMode="decimal"
              defaultValue={todayDraft ? todayDraft.toFixed(todayDraft % 1 === 0 ? 0 : 1) : ''}
              autoFocus
              onBlur={(e) => handleCommitWeightEdit(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
              }}
              onClick={(e) => e.stopPropagation()}
              className="min-w-[7.5rem] rounded-2xl border border-border bg-surface px-4 py-3 text-center font-timer text-4xl text-text-primary outline-none focus:border-accent"
              aria-label="Enter today's body weight"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (showLoggedCheck) setShowLoggedCheck(false);
                setIsEditingWeight(true);
              }}
              className="min-w-[7.5rem] rounded-2xl border border-border bg-surface px-4 py-3 text-center font-timer text-4xl text-text-primary"
              aria-label="Edit today's body weight"
            >
              {showLoggedCheck ? (
                <span className="flex flex-col items-center justify-center">
                  <Check className="h-8 w-8 text-success animate-check-pop" />
                  <span className="mt-1 text-xs font-semibold uppercase tracking-[1px] text-text-muted">
                    Logged
                  </span>
                </span>
              ) : (
                todayDraft ? todayDraft.toFixed(todayDraft % 1 === 0 ? 0 : 1) : '\u2014'
              )}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleAdjustDraft(step);
            }}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-elevated text-text-primary transition-transform active:scale-[0.97]"
            aria-label="Increase body weight"
          >
            <Plus className="h-5 w-5" />
          </button>

          <Button
            size="sm"
            variant="primary"
            disabled={todayDraft <= 0 || showLoggedCheck}
            loading={isSubmittingWeight}
            data-no-click-sfx="true"
            onClick={(e) => {
              e.stopPropagation();
              void handleSubmitToday();
            }}
          >
            Submit
          </Button>
        </div>
      </Card>

      {/* Recent changes + chart */}
      <Card
        padding="md"
        onClick={() => router.push('/weight')}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              Recent changes
            </p>
            <p className="text-xs text-text-muted">
              Last {weightTimeline} view
            </p>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TimelinePills
              value={weightTimeline}
              onChange={(v) => setWeightTimeline(v)}
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-3">
          <BodyWeightChart
            data={weightChartData}
            unitSystem={unitSystem}
            height={140}
          />
        </div>

        {recentEntries.length > 0 ? (
          <div className="mt-4 space-y-2">
            {recentEntries.map(({ dateKey, entry, deltaG }) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl bg-elevated px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-text-secondary">
                    {dateKey}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    {new Date(entry.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-text-primary">
                    {formatWeight(entry.weightG, unitSystem)}
                  </p>
                  {deltaG !== null ? (
                    <p className={`text-[11px] ${deltaG >= 0 ? 'text-success' : 'text-danger'}`}>
                      {deltaG >= 0 ? '+' : ''}
                      {formatWeightValue(deltaG, unitSystem)} {unitSystem}
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
            No weight entries yet. Add today&apos;s weight to start tracking.
          </p>
        )}
      </Card>

      {/* BMI changes */}
      <Card
        padding="md"
        className="mt-3"
        onClick={() => router.push('/weight')}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary">
              BMI changes
            </p>
            <p className="text-xs text-text-muted">
              {heightCm
                ? `Using height: ${Math.round(heightCm)} cm`
                : 'Add your height to compute BMI'}
            </p>
          </div>
          <div
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <TimelinePills
              value={bmiTimeline}
              onChange={(v) => setBmiTimeline(v)}
              ariaLabel="BMI timeline"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-3">
          {bmiMissing.height || bmiMissing.weight ? (
            <div className="mb-3 rounded-2xl border border-border bg-surface p-3 text-xs text-text-muted">
              To show BMI, add your{' '}
              {bmiMissing.height ? (
                <Link
                  href="/settings?focus=height"
                  className="font-semibold text-accent underline decoration-dotted underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  height
                </Link>
              ) : null}
              {bmiMissing.height && bmiMissing.weight ? ' and ' : null}
              {bmiMissing.weight ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    focusTodayWeight();
                  }}
                  className="font-semibold text-accent underline decoration-dotted underline-offset-2"
                >
                  weight
                </button>
              ) : null}
              .
            </div>
          ) : bmiHealthyRange === null ? (
            <div className="mb-3 rounded-2xl border border-border bg-surface p-3 text-xs text-text-muted">
              To show the healthy BMI range, add your{' '}
              {bmiMissing.age ? (
                <Link
                  href="/settings?focus=age"
                  className="font-semibold text-accent underline decoration-dotted underline-offset-2"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  age
                </Link>
              ) : (
                <span className="font-semibold text-text-secondary">age</span>
              )}
              {age !== null && age < 20 ? (
                <>
                  {' '}
                  and{' '}
                  {bmiMissing.sex ? (
                    <Link
                      href="/settings?focus=sex"
                      className="font-semibold text-accent underline decoration-dotted underline-offset-2"
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      sex
                    </Link>
                  ) : (
                    <span className="font-semibold text-text-secondary">sex</span>
                  )}
                  . BMI-for-age percentiles (under 20) aren&apos;t supported yet.
                </>
              ) : (
                '.'
              )}
            </div>
          ) : null}

          {heightCm && bmiChartData ? (
            <BmiChart
              data={bmiChartData}
              healthyRange={bmiHealthyRange}
              height={140}
            />
          ) : (
            <div className="flex h-[140px] items-center justify-center text-xs text-text-muted">
              BMI needs height + weight entries
            </div>
          )}
        </div>

        {/* Current BMI quick read */}
        {heightCm && (bodyWeights ?? []).length > 0 ? (
          <div className="mt-4 rounded-xl bg-elevated px-3 py-2">
            {(() => {
              const arr = bodyWeights ?? [];
              const latest = arr[arr.length - 1] ?? null;
              if (!latest) return null;
              const bmi = computeBmi(latest.weightG, heightCm);
              return (
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-text-secondary">Latest BMI</p>
                  <p className="text-sm font-semibold text-text-primary">{bmi}</p>
                </div>
              );
            })()}
          </div>
        ) : null}
      </Card>
    </section>
  );
}
