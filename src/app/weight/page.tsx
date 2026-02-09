'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronLeft } from 'lucide-react';
import { db } from '@/lib/db';
import { AppShell } from '@/components/layout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { useSettingsStore } from '@/stores/settingsStore';
import { formatWeight, formatWeightValue } from '@/lib/calculations';
import { ScaleIcon } from '@/components/icons/ScaleIcon';
import { BodyWeightChart } from '@/components/weight/BodyWeightChart';
import { TimelinePills, type WeightTimeline } from '@/components/weight/TimelinePills';
import { latestPerDay } from '@/lib/bodyWeight';
import type { BodyWeightEntry, UnitSystem } from '@/types/workout';

function buildChartData(
  entries: BodyWeightEntry[],
  timeline: WeightTimeline,
  unit: UnitSystem,
): Array<{ label: string; value: number | null }> {
  const byDay = latestPerDay(entries);
  const today = new Date();

  if (timeline === 'day') {
    // Last 2 days (today + yesterday) in local time, by-day points.
    const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));
    const points: Array<{ label: string; value: number | null }> = [];
    for (let i = 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const e = values.get(k);
      points.push({
        label: `${d.getMonth() + 1}/${d.getDate()}`,
        value: e ? Number(formatWeightValue(e.weightG, unit)) : null,
      });
    }
    return points;
  }

  if (timeline === 'year') {
    // Last 12 months, monthly latest.
    const monthMap = new Map<string, BodyWeightEntry>();
    for (const { dateKey, entry } of byDay) {
      const monthKey = dateKey.slice(0, 7); // YYYY-MM
      const existing = monthMap.get(monthKey);
      if (!existing || entry.recordedAt > existing.recordedAt) {
        monthMap.set(monthKey, entry);
      }
    }

    const points: Array<{ label: string; value: number | null }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(today);
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const e = monthMap.get(key);
      points.push({
        label: `${String(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`,
        value: e ? Number(formatWeightValue(e.weightG, unit)) : null,
      });
    }
    return points;
  }

  // week: last 7 days
  const values = new Map(byDay.map((x) => [x.dateKey, x.entry]));
  const points: Array<{ label: string; value: number | null }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const e = values.get(k);
    points.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      value: e ? Number(formatWeightValue(e.weightG, unit)) : null,
    });
  }
  return points;
}

export default function WeightPage() {
  const router = useRouter();
  const unitSystem = useSettingsStore((s) => s.unitSystem);
  const [timeline, setTimeline] = useState<WeightTimeline>('week');

  const bodyWeights = useLiveQuery(
    () => db.bodyWeights.orderBy('recordedAt').toArray(),
    [],
  );

  const byDayDesc = useMemo(() => {
    const series = latestPerDay(bodyWeights ?? []);
    return series.slice().reverse();
  }, [bodyWeights]);

  const chartData = useMemo(
    () => buildChartData(bodyWeights ?? [], timeline, unitSystem),
    [bodyWeights, timeline, unitSystem],
  );

  const latest = byDayDesc[0]?.entry ?? null;
  const prev = byDayDesc[1]?.entry ?? null;
  const deltaG = latest && prev ? latest.weightG - prev.weightG : null;

  return (
    <AppShell>
      <Header
        title="Weight Tracker"
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
        <div className="mb-3 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
          <ScaleIcon className="h-3.5 w-3.5" />
          <span>Overview</span>
        </div>

        <Card padding="md" className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Trend</p>
              <p className="text-xs text-text-muted">
                {latest ? `Latest: ${formatWeight(latest.weightG, unitSystem)}` : 'No entries yet'}
                {deltaG !== null ? ` · ${deltaG >= 0 ? '+' : ''}${formatWeightValue(deltaG, unitSystem)} ${unitSystem}` : ''}
              </p>
            </div>
            <TimelinePills value={timeline} onChange={setTimeline} vertical={false} />
          </div>

          <div className="mt-3 rounded-2xl border border-border bg-elevated/40 p-3">
            <BodyWeightChart data={chartData} unitSystem={unitSystem} height={240} />
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
        ) : (
          <div className="space-y-3">
            {byDayDesc.map(({ dateKey, entry }, idx) => {
              const prevEntry = byDayDesc[idx + 1]?.entry ?? null;
              const dG = prevEntry ? entry.weightG - prevEntry.weightG : null;
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
                        {formatWeight(entry.weightG, unitSystem)}
                      </p>
                      {dG !== null ? (
                        <p className={`text-xs ${dG >= 0 ? 'text-success' : 'text-danger'}`}>
                          {dG >= 0 ? '+' : ''}
                          {formatWeightValue(dG, unitSystem)} {unitSystem}
                        </p>
                      ) : (
                        <p className="text-xs text-text-muted">—</p>
                      )}
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

