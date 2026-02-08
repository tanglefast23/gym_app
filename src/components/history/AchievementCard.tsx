'use client';

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

interface AchievementCardProps {
  icon: string;
  iconSrc?: string;
  name: string;
  description: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  context?: string | null;
}

/**
 * A compact card for displaying an achievement in the horizontal scroll.
 * Unlocked achievements show full color and detail; locked ones are grayed out.
 */
export const AchievementCard = ({
  icon,
  iconSrc,
  name,
  description,
  isUnlocked,
  unlockedAt,
  context,
}: AchievementCardProps) => {
  const containerClasses = isUnlocked
    ? 'border border-warning/40 bg-surface animate-shimmer'
    : 'border border-border bg-surface/50';

  return (
    <div
      className={`flex w-[140px] shrink-0 flex-col items-center gap-2 rounded-2xl p-4 ${containerClasses}`}
    >
      {/* Icon */}
      {iconSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconSrc}
            alt=""
            className={[
              'h-12 w-12 select-none',
              isUnlocked ? '' : 'opacity-30 grayscale',
            ].join(' ')}
            draggable={false}
          />
        </>
      ) : (
        <span
          className={`text-[32px] leading-none ${isUnlocked ? '' : 'opacity-30 grayscale'}`}
          role="img"
          aria-label={name}
        >
          {icon}
        </span>
      )}

      {/* Name */}
      <p
        className={`text-center text-sm font-semibold ${
          isUnlocked ? 'text-text-primary' : 'text-text-muted'
        }`}
      >
        {name}
      </p>

      {/* Description */}
      <p className="text-center text-xs text-text-muted">
        {description}
      </p>

      {/* Context (only for unlocked) */}
      {isUnlocked && context ? (
        <p className="text-center text-xs text-accent">{context}</p>
      ) : null}

      {/* Unlock date (only for unlocked) */}
      {isUnlocked && unlockedAt ? (
        <p className="text-center text-[10px] text-text-muted">
          {shortDateFormatter.format(new Date(unlockedAt))}
        </p>
      ) : null}
    </div>
  );
};
