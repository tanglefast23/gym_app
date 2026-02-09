const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_365_MS = 365 * DAY_MS;

export function autoIncrementAge({
  age,
  ageUpdatedAt,
  now = new Date(),
}: {
  age: number | null;
  ageUpdatedAt: string | null;
  now?: Date;
}): { age: number | null; ageUpdatedAt: string | null } {
  if (age == null) return { age: null, ageUpdatedAt: null };

  const base = ageUpdatedAt ? new Date(ageUpdatedAt) : null;
  if (!base || Number.isNaN(base.getTime())) {
    // Anchor the age so future launches can increment from this point.
    return { age, ageUpdatedAt: now.toISOString() };
  }

  const diffMs = now.getTime() - base.getTime();
  if (diffMs < YEAR_365_MS) return { age, ageUpdatedAt };

  const yearsToAdd = Math.floor(diffMs / YEAR_365_MS);
  const nextAge = age + yearsToAdd;
  const nextBase = new Date(base.getTime() + yearsToAdd * YEAR_365_MS);
  return { age: nextAge, ageUpdatedAt: nextBase.toISOString() };
}

