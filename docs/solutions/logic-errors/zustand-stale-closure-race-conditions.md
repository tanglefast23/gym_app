---
title: "SetLogSheet Inline Weight Logging - Stale Closures & Race Conditions"
date: 2026-02-09
category: logic-errors
tags:
  - zustand
  - closures
  - race-conditions
  - state-management
  - react-hooks
  - ref-vs-state
  - setTimeout-cleanup
  - double-tap
module:
  - src/app/workout/[id]/page.tsx
  - src/components/active/SetLogSheet.tsx
  - src/components/active/ExerciseDisplay.tsx
  - src/hooks/useActiveWorkoutDerived.ts
symptoms:
  - "Rest timer starts with wrong duration after pressing DONE"
  - "SetLogSheet opens on a rest step showing 'undefined - Set 1/1'"
  - "Weight prefill shows 20kg/45lb instead of previous session's weight"
  - "Console warnings from unmounted component state updates"
severity: critical
confidence: high
---

# SetLogSheet Inline Weight Logging - Stale Closures & Race Conditions

## Problem

During a comprehensive 5-agent parallel review (simplicity, TypeScript patterns, architecture, race conditions, security) of the inline weight logging feature (SetLogSheet), several interconnected issues were discovered:

1. **Silent timer corruption** -- rest timer started with wrong duration after advancing steps
2. **Double-tap race** -- rapid DONE taps could open the sheet on a rest step
3. **Unmounted callback** -- 110ms setTimeout fired after ExerciseDisplay unmounted
4. **Stale weight prefill** -- IndexedDB hint arrived after render, but ref wasn't reactive
5. **Code complexity** -- ~30 LOC of unnecessary indirection (refs, props, memoization)

## Root Cause Analysis

### 1. Stale Zustand Closure (Critical)

After calling `advanceStep()` (Zustand `set()`), the closure still held the **pre-advance** `currentStepIndex`. The store updated synchronously, but React hadn't re-rendered yet.

```
Timeline:
1. Closure captures currentStepIndex = 4 (exercise step)
2. advanceStep() -> store now has currentStepIndex = 5
3. Closure reads steps[4 + 1] = steps[5] -> happens to be correct by coincidence
4. But if step layout differs, reads the WRONG step entirely
```

**Violated principle**: After Zustand mutation, never read captured closure values. Use `getState()`.

### 2. Double-Tap Window

`handleExerciseDone` had no guards. Between the 110ms DONE feedback delay and the sheet opening, a second tap could fire `onDone()` again, opening the sheet for a step that had already advanced.

### 3. Unmounted setTimeout

ExerciseDisplay used a bare `window.setTimeout` with no cleanup. If the component unmounted in those 110ms (e.g., timer auto-advanced at the exact same moment), `onDone()` fired on a dead component.

### 4. Ref Read During Render

`weightHintRef.current` was read in the render body to compute `prefillWeightG`. Refs don't trigger re-renders, so if the IndexedDB query resolved after the last render but before DONE was pressed, the sheet opened with stale prefill data.

## Solution

### Fix 1: Use `getState()` for Post-Mutation Reads

```typescript
// BEFORE (stale closure)
const advanceAndStartTimer = useCallback(() => {
  advanceStep();
  const nextStep = steps[currentStepIndex + 1]; // STALE
}, [advanceStep, steps, currentStepIndex, ...]);

// AFTER (fresh read)
const advanceAndStartTimer = useCallback(() => {
  advanceStep();
  const { steps: currentSteps, currentStepIndex: newIdx } =
    useActiveWorkoutStore.getState(); // FRESH
  const nextStep = currentSteps[newIdx];
}, [advanceStep, autoStartRestTimer, setTimerEndTime, timer]);
```

### Fix 2: Guard Preconditions

```typescript
const handleExerciseDone = useCallback(() => {
  if (showSetLogSheet) return;              // already open
  if (currentStep?.type !== 'exercise') return; // wrong step type
  haptics.tap();
  setShowSetLogSheet(true);
}, [showSetLogSheet, currentStep, haptics]);
```

### Fix 3: Ref-Based Timeout Cleanup

```typescript
const doneTimeoutRef = useRef<number | null>(null);

useEffect(() => {
  return () => {
    if (doneTimeoutRef.current !== null) {
      clearTimeout(doneTimeoutRef.current);
    }
  };
}, []);

const handleDone = useCallback(() => {
  if (doneFeedback) return;
  setDoneFeedback(true);
  doneTimeoutRef.current = window.setTimeout(() => {
    doneTimeoutRef.current = null;
    setDoneFeedback(false);
    onDone();
  }, 110);
}, [onDone, haptics, doneFeedback]);
```

### Fix 4: Promote Ref to State

```typescript
// BEFORE
const weightHintRef = useRef<{ avgG: number } | null>(null);
const prefillWeightG = weightHintRef.current?.avgG ?? fallback;

// AFTER
const [weightHintG, setWeightHintG] = useState<number | null>(null);
const prefillWeightG = weightHintG ?? fallback;
```

### Fix 5: Simplifications (~30 LOC removed)

| Change | LOC saved | Rationale |
|--------|-----------|-----------|
| Remove `pendingExerciseStepRef` | 6 | Step can't change while sheet is open |
| Stop passing `suggestedG` upstream | 4 | Parent never consumed it |
| Hardcode `WEIGHT_BIG_STEP = 5` | 8 | Was always literal `5` at every call site |
| `exerciseSteps.indexOf(currentStep)` | 5 | Replaces 7-line useMemo loop |
| Drop `useCallback` in remounted form | 6 | Form remounts on every open; memoization is pointless |
| Reuse `exerciseSteps.length` in derived hook | 1 | Eliminates duplicate `steps.filter` |

### Fix 6: Safety Bounds

- Added `max` to weight Stepper: 999 kg / 2204 lb (matches `VALIDATION.MAX_WEIGHT_G`)
- Added `Number.isFinite` + range clamping in `handleSetLogSave` before `upsertSet`

## Prevention Strategies

### Zustand Closure Audit Rule

After every `set()` call in a useCallback, ask: *"Do I read any captured value that was just mutated?"* If yes, use `getState()`.

```typescript
// Detector pattern:
myCallback = useCallback(() => {
  store.mutate();           // <-- mutation
  readCapturedValue();      // <-- RED FLAG: stale
  store.getState().value;   // <-- CORRECT: fresh
}, [capturedValue]);        // <-- dep doesn't help; still stale in THIS call
```

### Race Condition Checklist

For any callback that modifies UI state:
- Can this be called twice simultaneously? (add guard)
- Can preconditions change between check and action? (validate from fresh state)
- Does the callback survive component unmount? (add cleanup)

### Render-Time Value Rule

If a value is read during render, it must be **state** or a **stable prop**. Never read `useRef.current` during render for values that need to be "current."

### Async Cleanup Template

```typescript
useEffect(() => {
  const id = setTimeout(() => { /* ... */ }, delay);
  return () => clearTimeout(id);
}, [deps]);
```

## Key Takeaways

1. **Zustand `set()` is synchronous, closures are not** -- the #1 Zustand footgun. Use `getState()` after mutations.
2. **Guard every user-triggered callback** -- gym fingers are fast and sweaty. Double-taps happen.
3. **Refs are for side effects, not render-time data** -- if it needs to be current during render, use state.
4. **Every async operation needs cleanup** -- setTimeout, fetch, addEventListener.
5. **Complexity compounds bugs** -- each extra ref/prop/useMemo makes auditing harder. Delete what doesn't earn its weight.
6. **Five parallel reviewers catch what one misses** -- the race condition reviewer found bugs the simplicity reviewer missed, and vice versa.

## Related Files

- `src/app/workout/[id]/page.tsx` -- main workout orchestration
- `src/components/active/SetLogSheet.tsx` -- inline weight/reps form
- `src/components/active/ExerciseDisplay.tsx` -- exercise step with DONE button
- `src/hooks/useActiveWorkoutDerived.ts` -- derived workout state hook
- `FORJASON.md` -- project architecture documentation
