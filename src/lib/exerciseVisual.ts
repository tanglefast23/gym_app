/**
 * Exercise visual-key heuristics.
 *
 * We keep this logic client-safe + dependency-free so it can run during
 * active workouts. It's intentionally "good enough" fuzzy matching:
 * - case-insensitive
 * - punctuation-insensitive
 * - small spelling mistakes tolerated (edit distance)
 *
 * Returned keys must map to SVGs in `public/visuals/exercises/<key>.svg`.
 */

function normalize(input: string): { text: string; tokens: string[] } {
  const text = input
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  const tokens = text.length ? text.split(' ') : [];
  return { text, tokens };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const m = a.length;
  const n = b.length;
  const dp = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;

  for (let i = 1; i <= m; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j]! + 1, // deletion
        dp[j - 1]! + 1, // insertion
        prev + cost, // substitution
      );
      prev = tmp;
    }
  }
  return dp[n]!;
}

function tokenLike(token: string, keyword: string): boolean {
  if (token === keyword) return true;
  if (token.includes(keyword) || keyword.includes(token)) return true;

  // Allow small typos: tighter for short words.
  const d = levenshtein(token, keyword);
  const max = Math.max(token.length, keyword.length);
  const threshold = max <= 4 ? 1 : max <= 7 ? 2 : 3;
  return d <= threshold;
}

function hasAnyTokenLike(tokens: string[], keywords: string[]): boolean {
  for (const t of tokens) {
    for (const k of keywords) {
      if (tokenLike(t, k)) return true;
    }
  }
  return false;
}

function includesAny(text: string, phrases: string[]): boolean {
  for (const p of phrases) {
    if (text.includes(p)) return true;
  }
  return false;
}

/**
 * Map an exercise name to a visual key.
 *
 * Keys are intentionally coarse and cover common movement patterns + popular lifts.
 */
export function getVisualKeyForExerciseName(exerciseName: string): string {
  const { text, tokens } = normalize(exerciseName);
  if (!text) return 'default';

  // Multi-word patterns first (avoid ambiguous single-word matches).
  if (includesAny(text, ['bench press', 'benchpress'])) return 'bench';
  if (includesAny(text, ['overhead press', 'shoulder press', 'military press', 'strict press'])) {
    return 'overhead-press';
  }
  if (includesAny(text, ['lat pulldown', 'lat pull down', 'pull down', 'pulldown'])) return 'lat-pulldown';
  if (includesAny(text, ['pull up', 'pullup', 'chin up', 'chinup'])) return 'pull-up';
  if (includesAny(text, ['hip thrust', 'glute bridge', 'hip bridge'])) return 'hip-thrust';
  if (includesAny(text, ['calf raise', 'calves raise'])) return 'calf-raise';

  // Strong single-word signals.
  if (hasAnyTokenLike(tokens, ['squat', 'squats', 'squatting'])) return 'squat';
  if (hasAnyTokenLike(tokens, ['deadlift', 'deadlifts'])) return 'deadlift';
  if (hasAnyTokenLike(tokens, ['bench'])) return 'bench';
  if (hasAnyTokenLike(tokens, ['lunge', 'lunges'])) return 'lunge';
  if (hasAnyTokenLike(tokens, ['dip', 'dips'])) return 'dip';

  if (hasAnyTokenLike(tokens, ['row', 'rows', 'rowing'])) return 'row';
  if (hasAnyTokenLike(tokens, ['pullup', 'pull', 'chinup', 'chin'])) return 'pull-up';

  if (hasAnyTokenLike(tokens, ['press', 'presses', 'ohp', 'overhead', 'shoulder'])) return 'overhead-press';

  if (hasAnyTokenLike(tokens, ['curl', 'curls'])) return 'curl';
  if (hasAnyTokenLike(tokens, ['tricep', 'triceps', 'pushdown', 'extension', 'extensions'])) return 'triceps';
  if (hasAnyTokenLike(tokens, ['calf', 'calves'])) return 'calf-raise';
  if (hasAnyTokenLike(tokens, ['plank', 'situp', 'situps', 'crunch', 'crunches', 'ab', 'abs', 'core'])) return 'core';

  // Movement pattern fallbacks.
  if (hasAnyTokenLike(tokens, ['rdl', 'hinge', 'goodmorning', 'good', 'morning'])) return 'hinge';
  if (hasAnyTokenLike(tokens, ['push'])) return 'push';
  if (hasAnyTokenLike(tokens, ['pull'])) return 'pull';
  if (hasAnyTokenLike(tokens, ['arms', 'bicep', 'biceps'])) return 'arms';

  return 'default';
}

