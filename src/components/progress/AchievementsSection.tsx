'use client';

import { ACHIEVEMENTS } from '@/lib/achievements';
import { AchievementCard } from '@/components/history/AchievementCard';
import type { UnlockedAchievement } from '@/types/workout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AchievementsSectionProps {
  unlockedMap: Map<string, UnlockedAchievement>;
}

// ---------------------------------------------------------------------------
// AchievementsSection
// ---------------------------------------------------------------------------

export function AchievementsSection({ unlockedMap }: AchievementsSectionProps) {
  return (
    <section className="animate-fade-in-up stagger-6">
      <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[1px] text-text-muted">
        ACHIEVEMENTS
      </h2>
      <div
        className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none"
        tabIndex={0}
        role="region"
        aria-label="Achievements"
      >
        {ACHIEVEMENTS.map((def) => {
          const unlocked = unlockedMap.get(def.id);
          return (
            <AchievementCard
              key={def.id}
              iconSrc={`/visuals/badges/${def.id}.svg`}
              icon={def.icon}
              name={def.name}
              description={def.description}
              isUnlocked={!!unlocked}
              unlockedAt={unlocked?.unlockedAt}
              context={unlocked?.context}
            />
          );
        })}
      </div>
    </section>
  );
}
