'use client';

export type WeightTimeline = 'day' | 'week' | 'year';

const OPTIONS: Array<{ value: WeightTimeline; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'year', label: 'Year' },
];

export function TimelinePills({
  value,
  onChange,
  vertical = true,
}: {
  value: WeightTimeline;
  onChange: (v: WeightTimeline) => void;
  vertical?: boolean;
}) {
  return (
    <div
      className={[
        'inline-flex rounded-2xl bg-surface p-1',
        vertical ? 'flex-col gap-1' : 'flex-row gap-1',
      ].join(' ')}
      role="tablist"
      aria-label="Weight timeline"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={[
            'rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
            value === opt.value
              ? 'bg-elevated text-text-primary'
              : 'text-text-muted hover:text-text-secondary',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

