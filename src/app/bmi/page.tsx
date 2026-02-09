'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight } from '@/lib/calculations';
import { computeBmi, buildBmiChartData } from '@/lib/bmi';
import { TimelinePills, type WeightTimeline } from '@/components/weight/TimelinePills';
import { latestPerDay } from '@/lib/bodyWeight';
import { BmiChart } from '@/components/bmi/BmiChart';

function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Healthy';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}

export default function BmiPage() {
  const router = useRouter();
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const heightCm = useSettingsStore((s) => s.heightCm);
  const age = useSettingsStore((s) => s.age);
  const sex = useSettingsStore((s) => s.sex);
  const [timeline, setTimeline] = useState<WeightTimeline>('week');

  const bodyWeights = useLiveQuery(
    () => db.bodyWeights.orderBy('recordedAt').toArray(),
    [],
  );

  const byDayDesc = useMemo(() => {
    const series = latestPerDay(bodyWeights ?? []);
    return series.slice().reverse();
  }, [bodyWeights]);

  const chartData = useMemo(() => {
    if (heightCm == null || age == null || sex == null) return null;
    return buildBmiChartData(bodyWeights ?? [], heightCm, timeline);
  }, [bodyWeights, heightCm, age, sex, timeline]);

  const latest = byDayDesc[0]?.entry ?? null;
  const latestBmi = useMemo(() => {
    if (!latest || heightCm == null || age == null || sex == null) return null;
    return computeBmi(latest.weightG, heightCm);
  }, [latest, heightCm, age, sex]);

  const healthyRange = useMemo(() => {
    // Adult BMI range. (BMI-for-age percentiles < 20 not implemented.)
    return { min: 18.5, max: 24.9 };
  }, []);

  const needsHeight = heightCm == null;
  const needsWeight = byDayDesc.length === 0;
  const needsAge = age == null;
  const needsSex = sex == null;
  const canComputeBmi = !needsHeight && !needsWeight && !needsAge && !needsSex;

  const missingLinks = useMemo(() => {
    if (canComputeBmi) return null;
    const nodes: React.ReactNode[] = [];

    if (needsHeight) {
      nodes.push(
        <Link
          key="height"
          href="/settings?focus=height"
          className="font-semibold text-accent underline decoration-dotted underline-offset-2"
        >
          height
        </Link>,
      );
    }
    if (needsWeight) {
      nodes.push(
        <Link
          key="weight"
          href="/progress?focus=today-weight"
          className="font-semibold text-accent underline decoration-dotted underline-offset-2"
        >
          weight
        </Link>,
      );
    }
    if (needsAge) {
      nodes.push(
        <Link
          key="age"
          href="/settings?focus=age"
          className="font-semibold text-accent underline decoration-dotted underline-offset-2"
        >
          age
        </Link>,
      );
    }
    if (needsSex) {
      nodes.push(
        <Link
          key="sex"
          href="/settings?focus=sex"
          className="font-semibold text-accent underline decoration-dotted underline-offset-2"
        >
          sex
        </Link>,
      );
    }

    return (
      <>
        {nodes.map((n, idx) => (
          <span key={(n as unknown as { key?: string }).key ?? String(idx)}>
            {idx === 0 ? null : idx === nodes.length - 1 ? ' and ' : ', '}
            {n}
          </span>
        ))}
      </>
    );
  }, [canComputeBmi, needsAge, needsHeight, needsSex, needsWeight]);

  return (
    <AppShell>
      <Header
        title="BMI Tracker"
        centered
        leftAction={
          <button
            type="button"
            onClick={() => router.back()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-accent"
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        }
      />

      <div className="px-5 pt-4 pb-8">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
            Overview
          </div>
          <TimelinePills value={timeline} onChange={setTimeline} vertical={false} ariaLabel="BMI timeline" />
        </div>

        <Card padding="md" className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary">Trend</p>
              <p className="text-xs text-text-muted">
                {latestBmi !== null ? (
                  <>
                    Latest: <span className="font-semibold text-text-secondary">{latestBmi}</span>
                    <span className="ml-2">({bmiCategory(latestBmi)})</span>
                  </>
                ) : (
                  'Add missing details to compute BMI'
                )}
              </p>
              {heightCm != null ? (
                <p className="mt-1 text-[11px] text-text-muted">
                  Height: {Math.round(heightCm)} cm
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-3">
            {!canComputeBmi ? (
              <div className="mb-3 rounded-2xl border border-border bg-surface p-3 text-xs text-text-muted">
                Missing:{' '}
                {missingLinks}
                .
              </div>
            ) : null}

            {heightCm != null && chartData ? (
              <BmiChart data={chartData} healthyRange={healthyRange} height={240} />
            ) : (
              <div className="flex h-[240px] items-center justify-center text-xs text-text-muted">
                BMI needs height, weight, age, and sex
              </div>
            )}
          </div>
        </Card>

        <div className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
          History
        </div>

        {byDayDesc.length === 0 ? (
          <Card padding="md">
            <p className="text-sm text-text-muted">
              No weight entries yet. Add today&apos;s weight from the Progress tab.
            </p>
          </Card>
        ) : !canComputeBmi ? (
          <Card padding="md">
            <p className="text-sm text-text-muted">
              Missing:{' '}
              {missingLinks}
              .
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {byDayDesc.map(({ dateKey, entry }) => {
              const bmi = computeBmi(entry.weightG, heightCm);
              return (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-border bg-surface px-4 py-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{dateKey}</p>
                      <p className="text-xs text-text-muted">
                        {new Date(entry.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-text-primary">
                        {bmi}
                      </p>
                      <p className="text-xs text-text-muted">
                        {bmiCategory(bmi)} · {formatWeight(entry.weightG, unitSystem)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
