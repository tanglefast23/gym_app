'use client';

interface AchievementCardProps {
  icon: string;
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
  name,
  description,
  isUnlocked,
  unlockedAt,
  context,
}: AchievementCardProps) => {
  const containerClasses = isUnlocked
    ? 'border border-accent/30 bg-surface'
    : 'border border-border bg-surface/50';

  return (
    <div
      className={`flex min-w-[120px] shrink-0 flex-col items-center rounded-2xl p-3 ${containerClasses}`}
    >
      {/* Icon */}
      <span
        className={`text-2xl ${isUnlocked ? '' : 'opacity-30 grayscale'}`}
        role="img"
        aria-label={name}
      >
        {icon}
      </span>

      {/* Name */}
      <p
        className={`mt-2 text-center text-sm font-medium ${
          isUnlocked ? 'text-text-primary' : 'text-text-muted'
        }`}
      >
        {name}
      </p>

      {/* Description */}
      <p className="mt-0.5 text-center text-xs text-text-muted">
        {description}
      </p>

      {/* Context (only for unlocked) */}
      {isUnlocked && context ? (
        <p className="mt-1 text-center text-xs text-accent">{context}</p>
      ) : null}

      {/* Unlock date (only for unlocked) */}
      {isUnlocked && unlockedAt ? (
        <p className="mt-1 text-center text-[10px] text-text-muted">
          {new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
          }).format(new Date(unlockedAt))}
        </p>
      ) : null}
    </div>
  );
};
