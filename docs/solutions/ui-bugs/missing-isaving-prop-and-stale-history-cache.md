---
title: "Missing isSaving Prop & Stale Exercise History Cache"
date: 2026-02-09
category: ui-bugs
tags:
  - prop-drilling
  - caching
  - module-scope
  - spa-navigation
  - double-submit
  - react-state
  - client-side-routing
module:
  - src/app/workout/[id]/page.tsx
  - src/components/active/WeightRecap.tsx
  - src/components/active/ExerciseDisplay.tsx
  - src/components/active/index.ts
symptoms:
  - "Save Workout button has no loading spinner during save"
  - "Save Workout button can be tapped multiple times rapidly"
  - "Exercise 'Last avg' hint shows outdated weight from two sessions ago"
  - "Starting a new workout shows stale historical data in ExerciseDisplay"
severity: medium
confidence: high
---

# Missing isSaving Prop & Stale Exercise History Cache

## Problem

Two bugs discovered during a workflow review of the active workout pipeline:

1. **No save loading state** — the Save Workout button in the recap phase never showed a spinner or disabled state, allowing double-tap duplicate saves.
2. **Stale weight hints** — the "Last avg" badge on ExerciseDisplay showed data from *before* the previous workout because a module-level cache was never invalidated.

## Root Cause Analysis

### Bug 1: Optional Prop Silently Omitted

`WeightRecap` declared `isSaving` as optional:

```typescript
interface WeightRecapProps {
  // ...
  isSaving?: boolean;  // <-- optional, so TypeScript accepts omission
}
```

The parent (`page.tsx`) defined `const [isSaving, setIsSaving] = useState(false)` and used it in `handleSaveWorkout`, but never passed it down:

```tsx
// page.tsx — recap render (BEFORE)
<WeightRecap
  steps={exerciseSteps}
  performedSets={performedSets}
  onComplete={handleSaveWorkout}
  onSavePartial={handleSaveWorkout}
  onDiscard={handleDiscard}
  // isSaving NOT passed ← bug
/>
```

`WeightRecap` forwarded `isSaving={isSaving ?? false}` to `RecapNavigation`, which used it for both `loading` and `disabled` on the Save button. Without the prop, `isSaving` was always `undefined → false`.

The `handleSaveWorkout` guard (`if (isSaving) return;`) used React state, which doesn't update synchronously — two rapid taps before re-render could both see `isSaving = false`.

### Bug 2: Module-Level Cache Outlives Component

`ExerciseDisplay.tsx` cached IndexedDB query results at module scope:

```typescript
// Module scope — lives as long as the JS module is loaded
const exerciseHistoryCache = new Map<string, PerformedSet[]>();
```

The cache was populated the first time each exercise was shown and never cleared. In an SPA with client-side navigation (`router.push('/')`), JS modules stay loaded. After completing workout A and starting workout B:

```
Timeline:
1. Workout A starts → cache empty → fetches from IndexedDB → caches results
2. Workout A completes → log saved to IndexedDB → navigate to home (client-side)
3. Workout B starts → cache still has Workout A's pre-start data
4. ExerciseDisplay hits cache → shows "Last avg" from BEFORE Workout A
   (should show Workout A's results)
```

## Solution

### Fix 1: Pass the Prop

One line:

```tsx
// page.tsx — recap render (AFTER)
<WeightRecap
  steps={exerciseSteps}
  performedSets={performedSets}
  onComplete={handleSaveWorkout}
  onSavePartial={handleSaveWorkout}
  onDiscard={handleDiscard}
  isSaving={isSaving}  // ← added
/>
```

### Fix 2: Export Cache-Clear Function, Call on Workout Start

```typescript
// ExerciseDisplay.tsx
const exerciseHistoryCache = new Map<string, PerformedSet[]>();

/** Clear the history cache so the next workout fetches fresh data. */
export function clearExerciseHistoryCache(): void {
  exerciseHistoryCache.clear();
}
```

```typescript
// index.ts — re-export
export { ExerciseDisplay, clearExerciseHistoryCache } from './ExerciseDisplay';
```

```typescript
// page.tsx — workout initialization effect
if (template && !isActive && !hasStartedRef.current) {
  hasStartedRef.current = true;
  clearExerciseHistoryCache();  // ← added: flush stale data
  startWorkout(/* ... */);
}
```

**Why clear on start, not on completion?** Clearing on workout start is safer because it guarantees fresh data regardless of *how* the user reached the next workout — normal flow, crash recovery, browser back/forward, or deep link.

## Prevention Strategies

### Optional Props That Control Critical UI

**Rule:** If a prop controls `disabled`, `loading`, or `aria-*` states, make it **required**. The TypeScript compiler will enforce it at every call site.

```typescript
// FRAGILE — omission compiles silently
interface Props { isSaving?: boolean; }

// SAFE — omission is a compile error
interface Props { isSaving: boolean; }
```

Reserve `?` for truly optional cosmetic props (className overrides, labels with defaults).

### Module-Level Caches in SPAs

**Rule:** Every module-level cache needs an explicit invalidation strategy documented next to its declaration.

```typescript
// Good: invalidation strategy is visible
const cache = new Map<string, Data[]>();
// Cleared by: clearCache() called from page init
// Lifetime: single workout session
export function clearCache(): void { cache.clear(); }
```

**When module-level caches are appropriate:**
- Data is expensive to fetch and unlikely to change mid-session
- The scope is a single "session" (workout, form wizard, etc.)
- There is a clear invalidation point (session start/end)

**When they are dangerous:**
- Data changes frequently (use React Query / SWR instead)
- No natural invalidation point exists
- Multiple concurrent consumers may need different versions

### Audit Checklist

- [ ] For every optional prop with a fallback: is the fallback the correct behavior, or a silent bug?
- [ ] For every module-level `Map`/`Set`/object: what clears it? Document it inline.
- [ ] For every `useState` used as an async guard: would a `useRef` be more reliable?
- [ ] After adding a new prop to a child component: grep all parent call sites to verify it's passed.

## Key Takeaways

1. **Optional props hide bugs** — TypeScript's `?` is a convenience that silences the compiler at exactly the wrong moment. Make critical-path props required.
2. **SPAs keep modules alive** — `router.push()` doesn't reload JS. Any state outside React (module scope, `window`, `localStorage`) survives navigation and must be managed explicitly.
3. **Clear on entry, not exit** — invalidating caches when entering a new context is more robust than trying to clean up on the way out (the exit path has more failure modes).
4. **React state is a poor mutex** — `useState` for double-submit guards has a race window between `setState` and re-render. For critical guards, a `useRef` updated synchronously is safer.

## Related Files

- `src/app/workout/[id]/page.tsx` — main workout orchestration (both fixes)
- `src/components/active/ExerciseDisplay.tsx` — history cache + clear function
- `src/components/active/WeightRecap.tsx` — consumes `isSaving` prop
- `src/components/active/RecapNavigation.tsx` — uses `isSaving` for button state
- `src/components/active/index.ts` — barrel re-export
- `docs/solutions/logic-errors/zustand-stale-closure-race-conditions.md` — related: Zustand closure patterns from SetLogSheet feature
- `FORJASON.md` — Lesson 1 (Zustand v5 selector gotcha)
