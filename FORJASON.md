# FORJASON.md -- Workout PWA

A local-only Progressive Web App for tracking weight-training workouts. No accounts, no servers, no subscriptions. Your phone *is* the database.

---

## Technical Architecture

### The Big Idea

Think of this app like a really smart clipboard that lives in your browser. You design workout templates (the blueprint), execute them step-by-step (the workout), and every completed session gets frozen into a log (the archive). There is no backend. There is no cloud. Everything lives in IndexedDB on your device, which means it works in airplane mode, in a concrete-walled gym basement, or on a mountain -- anywhere you can open a browser.

The architectural philosophy is "local-first with zero trust in the network." The service worker caches all assets on first visit, IndexedDB persists all data beyond the browser session, and the entire build is a static export -- just HTML, CSS, and JS files that could be served from a USB stick.

### How Data Flows

```
Template (blueprint)
    |
    v
generateSteps() -- pure function, deterministic
    |
    v
Flat step array: [exercise, rest, exercise, rest, ..., complete]
    |
    v
Zustand store walks the index (currentStepIndex++)
    |
    v
User logs reps/weight at each exercise step
    |
    v
completeWorkout() freezes everything into a WorkoutLog
    |
    v
WorkoutLog + denormalized ExerciseHistoryEntry -> IndexedDB
    |
    v
Charts read ExerciseHistoryEntry via compound index queries
```

The most important idea in this flow is **the snapshot pattern**. When you start a workout, the template's blocks are deep-copied into `templateSnapshot`. When the workout is saved, that snapshot is frozen into the `WorkoutLog`. This means if you later edit the template -- change the sets from 4 to 5, swap an exercise -- your historical logs remain exactly as they were. History is immutable. The template is just a starting point.

### The Three Storage Layers

The app uses a 3-layer crash recovery strategy, where each layer trades durability for speed:

| Layer | Technology | Survives | Write Speed | Purpose |
|-------|-----------|----------|-------------|---------|
| 1 | Zustand (memory) | Nothing (tab close kills it) | Instant | Active workout state machine |
| 2 | sessionStorage (Zustand persist) | Tab refreshes | ~1ms | In-tab crash recovery |
| 3 | IndexedDB (Dexie) | Everything except clearing browser data | ~5-10ms | Permanent storage, cross-tab recovery |

Layer 2 writes happen on every Zustand state change (via the `persist` middleware). Layer 3 writes happen every 30 seconds during an active workout and on `visibilitychange` (when the user switches away from the tab). If the app crashes and reloads, it checks Layer 2 first (same tab), then Layer 3 (crash recovery record), and offers to resume.

---

## Codebase Structure

```
src/
  app/                        # Next.js App Router pages
    layout.tsx                 # Root layout: fonts, viewport meta, CSP header
    manifest.ts                # PWA manifest (name, icons, display: standalone)
    sw.ts                      # Service worker (Serwist config)
    page.tsx                   # Home -- template list
    create/page.tsx            # Create new template
    edit/[id]/page.tsx         # Edit existing template
    workout/[id]/page.tsx      # Active workout execution screen
    history/page.tsx           # All workout logs
    history/[id]/page.tsx      # Single log detail view
    history/exercise/[id]/     # Exercise-specific progress charts
    settings/page.tsx          # User preferences
    ~offline/page.tsx          # Offline fallback page

  types/
    workout.ts                 # THE source of truth for all data shapes
                               # Every interface, every constant lives here

  lib/                         # Pure logic, no React
    db.ts                      # Dexie database definition (7 tables)
    stepEngine.ts              # Template blocks -> flat step array
    calculations.ts            # Weight conversion, 1RM, volume, formatting
    queries.ts                 # Dexie query helpers (compound index usage)
    validation.ts              # Input sanitization and constraint checking
    achievements.ts            # Achievement definitions and checking logic
    exportImport.ts            # JSON export/import with transactional safety

  stores/                      # Zustand state management
    activeWorkoutStore.ts      # In-progress workout: steps, timer, sets
    settingsStore.ts           # User prefs: units, rest time, haptics, theme

  hooks/                       # Custom React hooks
    useTimer.ts                # Web Worker timer with visibility recovery
    useWakeLock.ts             # Screen Wake Lock API wrapper
    useHaptics.ts              # Vibration API with setting-based gating
    useInstallPrompt.ts        # Deferred PWA install prompt

  components/
    active/                    # Workout execution UI
      ExerciseDisplay.tsx      # Current exercise: name, set count, rep target
      RestTimer.tsx            # Countdown ring with +10s / -10s / skip
      TimerRing.tsx            # SVG circular progress indicator
      WeightRecap.tsx          # Post-exercise weight/reps entry
      WorkoutComplete.tsx      # Summary screen after finishing

    history/                   # History and analytics UI
      LogCard.tsx              # Summary card for a workout log
      ProgressChart.tsx        # Lazy wrapper for Recharts (next/dynamic)
      ProgressChartContent.tsx # Actual Recharts implementation
      AchievementCard.tsx      # Unlocked achievement display

    workout/                   # Template editing UI
      WorkoutCard.tsx          # Template card on the home screen
      ExerciseBlockEditor.tsx  # Edit an exercise block in a template
      SupersetBlockEditor.tsx  # Edit a superset block in a template
      ExerciseAutocomplete.tsx # Searchable exercise picker

    layout/                    # App shell and navigation
      AppShell.tsx             # Main layout wrapper
      Header.tsx               # Top bar
      BottomTabBar.tsx         # Mobile tab navigation

    ui/                        # Reusable primitives
      Button.tsx, Card.tsx, Stepper.tsx, Toast.tsx,
      BottomSheet.tsx, ConfirmDialog.tsx, EmptyState.tsx

  workers/
    timer.worker.ts            # Web Worker running setInterval(100ms)
```

### How the Parts Connect

The dependency flow is strictly one-directional:

```
types/workout.ts        <-- Everything depends on this
    |
    v
lib/ (db, stepEngine,   <-- Pure logic, depends only on types
     calculations, ...)
    |
    v
stores/ (Zustand)        <-- Depends on types + lib
    |
    v
hooks/                   <-- Depends on stores + lib
    |
    v
components/              <-- Depends on hooks + stores + lib
    |
    v
app/ (pages)             <-- Depends on components
```

The `types/workout.ts` file is the single source of truth. If you want to understand any piece of the app, start there. It defines every interface, every validation constant, and every default value. The entire project is roughly 2,500 lines of TypeScript across ~45 files.

---

## Technology Choices

### Next.js 16 with Static Export

**Why:** A PWA needs to work completely offline. Server-side rendering requires... a server. By using `output: "export"` in `next.config.ts`, the entire app compiles down to static HTML/CSS/JS files. You could host this on GitHub Pages, an S3 bucket, or even open it from a local filesystem. Next.js gives us the App Router, file-based routing, and `next/dynamic` for lazy loading -- all of which are purely client-side features in export mode.

**Tradeoff considered:** Could have used Vite + React Router, which would be simpler. But Next.js's font optimization (Geist fonts), built-in image handling, and the Serwist integration plugin tipped the scale. The framework overhead is negligible for a PWA that gets cached on first load.

### Dexie.js v4 (IndexedDB Wrapper)

**Why:** Raw IndexedDB is notoriously painful. Its API is callback-based, error handling is fragile, and there is no concept of typed tables. Dexie wraps it with a promise-based API, typed generic tables (`Table<Exercise, string>`), compound indexes, versioned schema migrations, and transactional guarantees. The storage limit in most browsers is >100MB for origin-based storage, which is more than enough for years of workout logs.

**Tradeoff considered:** localStorage is simpler but caps at ~5MB and is synchronous (blocks the main thread). SQLite via WASM (sql.js) is powerful but adds ~500KB to the bundle and requires manual persistence. Dexie hits the sweet spot.

### Zustand v5

**Why:** The active workout has a timer ticking every 100ms. Any state management solution that triggers re-renders on the entire component tree would make the UI jank during rest periods. Zustand's selector pattern (`useStore((s) => s.field)`) ensures that only the component reading `remainingMs` re-renders on each tick. Redux could do this too, but Zustand is ~1KB and requires zero boilerplate. MobX uses proxies which add subtle complexity. Zustand is just functions.

**Tradeoff considered:** React Context would cause re-renders on every state change unless you split into dozens of contexts. Jotai is similar to Zustand but atom-based, which is an architectural preference. We went with Zustand because the store shape maps cleanly to "one workout session = one object."

### Serwist v9 (Service Worker)

**Why:** Serwist is the maintained fork of Workbox's Next.js integration after Google deprioritized it. It provides precaching of all static assets, runtime caching strategies, an offline fallback page, and `skipWaiting` + `clientsClaim` for immediate activation. The `@serwist/next` plugin integrates directly into `next.config.ts` so the service worker is part of the build pipeline.

**Tradeoff considered:** Writing a raw service worker is possible but tedious -- you would need to manually manage the cache manifest, handle versioning, implement strategies. Serwist automates all of this.

### Recharts (Lazy-Loaded)

**Why:** Recharts is built on D3 and React, so it composes naturally with the component tree. It is ~40KB gzipped, which is significant for a PWA that should load fast. We use `next/dynamic` with `ssr: false` to lazy-load it only when the user navigates to the progress charts page. Users who never look at charts never download the chart code.

**Tradeoff considered:** Chart.js is lighter but uses canvas (harder to style with Tailwind). Victory is heavier. Lightweight options like uPlot are fast but not React-native. Recharts gave us the best developer experience for the bundle cost.

### Integer Grams for Weight Storage

**Why:** JavaScript uses IEEE 754 floating-point numbers. The expression `2.5 + 2.5` evaluates to `5` in most cases, but `0.1 + 0.2` famously evaluates to `0.30000000000000004`. When you are tracking weight progression over months, these tiny errors compound and corrupt your data. By storing all weights as integer grams (so 2.5 kg becomes `2500`), arithmetic is always exact. The conversion to display units (`kg` or `lb`) happens at the UI boundary, right before rendering.

**Tradeoff considered:** Using `toFixed()` at every arithmetic operation. This works but is error-prone -- one missed conversion and the bug surfaces months later. Integer storage makes correctness the default.

---

## Lessons Learned

This is the section that will save you hours of debugging. Each lesson was learned the hard way.

### 1. Zustand v5 Selector Gotcha

This is subtle and devastating. In Zustand v5, calling `useStore()` without a selector subscribes the component to the **entire store**. Every field change triggers a re-render.

```typescript
// BAD: This component re-renders on every timer tick, every set logged,
// every step advanced -- everything.
const Component = () => {
  const store = useActiveWorkoutStore();
  return <div>{store.templateName}</div>;
};

// GOOD: This component only re-renders when templateName changes.
const Component = () => {
  const templateName = useActiveWorkoutStore((s) => s.templateName);
  return <div>{templateName}</div>;
};
```

During active workouts, the timer updates `timerEndTime` or the remaining time is derived from the worker at 100ms intervals. Without selectors, every component in the workout screen would re-render 10 times per second. On mid-range phones, this causes visible jank and dropped frames. Both stores in this project have a big warning comment at the top of their interface definitions.

### 2. Web Worker Timer Pattern

Here is a fun browser fact: when you switch to a different tab, Chrome throttles `setInterval` to fire at most **once per minute**. On mobile Safari, it might stop entirely. So if your rest timer is based on counting ticks (`count += 1` every 100ms), it will drift catastrophically when the user checks a text message.

The solution is a two-part architecture:

**Part 1: The Worker** (`timer.worker.ts`) runs `setInterval(tick, 100)` inside a Web Worker. Workers are not throttled as aggressively as the main thread. But the critical insight is that the tick function does not count -- it computes:

```typescript
function tick(): void {
  const remaining = endTime - Date.now();
  if (remaining <= 0) {
    stop();
    self.postMessage({ type: 'COMPLETE' });
    return;
  }
  self.postMessage({ type: 'TICK', remaining });
}
```

`endTime` is an absolute timestamp (`Date.now() + durationMs`), set once when the timer starts. Each tick derives the remaining time from the clock. If the worker was paused for 30 seconds by the OS, the next tick will correctly show 30 fewer seconds.

**Part 2: Visibility Recovery** (`useTimer.ts`) listens for `visibilitychange`. When the tab becomes visible again, it checks if `endTime` has passed. If yes, it fires the completion callback immediately. If no, it updates the displayed time to the correct value. This handles the case where even the worker was suspended.

```typescript
function handleVisibility(): void {
  if (document.visibilityState === 'visible' && endTimeRef.current > 0) {
    const remaining = endTimeRef.current - Date.now();
    if (remaining <= 0) {
      // Timer expired while backgrounded -- fire completion now
      onCompleteRef.current();
    } else {
      setRemainingMs(remaining);
    }
  }
}
```

### 3. Integer Grams Storage

This one is deceptively simple but has big implications.

```typescript
// The problem:
2.5 + 2.5        // 5         (fine)
0.1 + 0.2        // 0.30...04 (not fine)
27.5 + 2.5 + 2.5 // might be 32.5, might be 32.500000000000004

// The solution: store as integer grams
kgToGrams(2.5)   // 2500 (Math.round(2.5 * 1000))
2500 + 2500      // 5000 (always exact)
gramsToKg(5000)   // 5    (5000 / 1000, always exact for our increments)
```

The conversion functions live in `calculations.ts`. The rule is: **grams in, grams out, display at the boundary**. The `PerformedSet` type stores `weightG: number` (integer grams). The `ExerciseHistoryEntry` stores `bestWeightG`, `totalVolumeG`, and `estimated1RM_G` -- all integer grams. The only place we convert to `kg` or `lb` is in `formatWeight()` and `formatWeightValue()`, which are called at render time.

The unit system preference (`kg` or `lb`) lives in the settings store. Changing units does not modify any stored data -- it just changes which conversion function runs at display time.

### 4. Snapshot-Based History

Imagine you have a "Push Day" template with Bench Press at 4x8. You complete 10 workouts over a month. Then you change the template to 5x5. Without snapshots, your historical logs would retroactively show 5x5, which is a lie -- you actually did 4x8 those days.

The fix is simple but requires discipline:

```typescript
// When starting a workout:
set({
  templateSnapshot: blocks,  // deep copy at this moment in time
  // ...
});

// When saving the log:
const log: WorkoutLog = {
  templateSnapshot,  // frozen forever
  // ...
};
```

The `WorkoutLog` type has both `templateId` (for linking back to the template, which may no longer exist) and `templateSnapshot` (the blocks as they were when the workout started). The log is a self-contained record. You could delete every template and every exercise from the library, and the logs would still render correctly because they carry their own copy of the data.

### 5. Dexie Compound Indexes

IndexedDB supports compound indexes, and Dexie makes them easy to declare:

```typescript
this.version(1).stores({
  logs: 'id, templateId, startedAt, status, [templateId+startedAt]',
  exerciseHistory: '++id, exerciseId, exerciseName, logId, performedAt, [exerciseName+performedAt]',
});
```

The compound index `[exerciseName+performedAt]` enables a single-query lookup for "show me all Bench Press history in chronological order" without client-side filtering or sorting:

```typescript
export async function getExerciseHistory(exerciseName: string): Promise<ExerciseHistoryEntry[]> {
  return db.exerciseHistory
    .where('[exerciseName+performedAt]')
    .between([exerciseName, ''], [exerciseName, '\uffff'])
    .toArray();
}
```

The `'\uffff'` trick is the Dexie idiom for "any string that starts with this prefix." It works because `'\uffff'` sorts after any normal Unicode character. This is the IndexedDB equivalent of `WHERE exerciseName = ? ORDER BY performedAt ASC` in SQL, but it runs entirely client-side in a single index scan.

### 6. 3-Layer Crash Recovery

Losing a workout to a crash feels terrible. You just spent 45 minutes lifting and the data is gone. The 3-layer approach makes this nearly impossible:

**Layer 1: Memory (Zustand)** -- The source of truth during the workout. Every action (`advanceStep`, `logSet`, `setTimerEndTime`) updates the store. This is fast but volatile.

**Layer 2: sessionStorage (Zustand persist middleware)** -- The persist middleware serializes the entire store to `sessionStorage` on every state change. If the page refreshes within the same tab, Zustand rehydrates from here automatically. This is the "oops I pulled down to refresh" safety net.

**Layer 3: IndexedDB (writeCrashRecovery)** -- Every 30 seconds, and on every `visibilitychange` event, the app writes a `CrashRecoveryData` record to Dexie. If the browser process dies, the tab closes, or the phone reboots, this record survives. On next app launch, we check for it and offer to resume.

```typescript
// In the store:
writeCrashRecovery: async () => {
  const recoveryData: CrashRecoveryData = {
    id: 'recovery',       // singleton key -- always overwritten
    sessionState: { ... },
    templateId,
    templateName,
    savedAt: new Date().toISOString(),
  };
  await db.crashRecovery.put(recoveryData);
},
```

The recovery record has a 4-hour max age (`RECOVERY_MAX_AGE_MS`). If it is older than that, we discard it rather than offering to resume a stale session.

### 7. Deterministic Step Engine

The `generateSteps()` function is the heart of the workout execution flow, and its most important property is that it is **pure**. Same inputs, same outputs. No side effects, no randomness, no state.

```typescript
export function generateSteps(
  blocks: TemplateBlock[],
  templateDefaultRest: number | null,
  globalDefaultRest: number,
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  // ... iterate blocks, expand into exercise + rest steps ...
  steps.push({ type: 'complete', blockIndex: blocks.length });
  return steps;
}
```

The result is a flat array like:

```
[
  { type: 'exercise', blockIndex: 0, setIndex: 0, ... },  // Bench Set 1
  { type: 'rest',     blockIndex: 0, restDurationSec: 90 },
  { type: 'exercise', blockIndex: 0, setIndex: 1, ... },  // Bench Set 2
  { type: 'rest',     blockIndex: 0, restDurationSec: 90 },
  { type: 'exercise', blockIndex: 0, setIndex: 2, ... },  // Bench Set 3
  { type: 'exercise', blockIndex: 1, setIndex: 0, ... },  // Squat Set 1
  ...
  { type: 'complete', blockIndex: 2 }
]
```

The UI just reads `steps[currentStepIndex]` and renders the appropriate component. Advancing is `currentStepIndex += 1`. Ending early jumps to the `complete` step. There is no state machine with transitions to reason about -- just an array and an index. This makes the execution logic almost impossible to get wrong, and trivial to test. You can unit-test `generateSteps()` with zero mocking.

The rest duration uses a 3-level fallback chain: block-level rest overrides template-level default, which overrides the global setting. This is handled by the `resolveRest()` helper:

```typescript
export function resolveRest(
  blockRest: number | null,
  templateRest: number | null,
  globalRest: number,
): number {
  return blockRest ?? templateRest ?? globalRest;
}
```

### 8. CSP on a Local-Only App

The app has no server, no API calls, no third-party scripts. So why bother with a Content Security Policy? Because **import is a data vector**. The app supports JSON import for backup restoration. A crafted JSON file could theoretically inject content. And if the app is ever served from a shared hosting environment, XSS protection matters.

```html
<meta
  httpEquiv="Content-Security-Policy"
  content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' data:; font-src 'self' data:;"
/>
```

Key decisions:
- `default-src 'self'` blocks any external resource loading
- `worker-src 'self' blob:` allows Web Workers (needed for the timer)
- `style-src 'unsafe-inline'` is required because Tailwind injects styles at runtime
- `img-src 'self' data:` allows data URIs for inline SVG icons
- No `connect-src` needed -- the app never makes network requests after initial load

### 9. Lazy Loading Charts

Recharts pulls in D3 under the hood. Together they add roughly 40KB gzipped to the bundle. Most users open the app, do a workout, and close it. They might look at charts once a week. Loading chart code on every page visit would be wasteful.

```typescript
const ChartContent = dynamic(() => import('./ProgressChartContent'), {
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  ),
  ssr: false,
});
```

`next/dynamic` with `ssr: false` creates a code-split chunk that is only downloaded when the `ProgressChart` component mounts. The `loading` prop shows a spinner while the chunk loads. After the first load, the service worker caches it, so subsequent visits are instant.

The `ProgressChart` component is a thin wrapper that reads the unit system from the settings store and passes it to the lazy-loaded `ProgressChartContent`. This separation means the settings store subscription runs immediately (it is tiny), while the heavy chart rendering waits for the dynamic import.

### 10. Wake Lock API

Picture this: you finish a set, the rest timer starts counting down from 90 seconds, and you set your phone down. After 30 seconds, the screen turns off. Now you have to unlock your phone, navigate back to the app, and figure out where you were. Annoying.

The Wake Lock API solves this:

```typescript
export function useWakeLock(): UseWakeLockReturn {
  const request = useCallback(async (): Promise<void> => {
    const sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => {
      setIsActive(false);
      sentinelRef.current = null;
    });
    sentinelRef.current = sentinel;
    wasActiveRef.current = true;
    setIsActive(true);
  }, []);
  // ...
}
```

But there is a catch: the browser **automatically releases** the wake lock when the page becomes hidden (user switches tabs, locks phone, etc.). When they come back, the lock is gone. The fix is to re-acquire it on `visibilitychange`:

```typescript
useEffect(() => {
  function handleVisibilityChange(): void {
    if (
      document.visibilityState === 'visible' &&
      wasActiveRef.current &&
      !sentinelRef.current
    ) {
      void request(); // re-acquire
    }
  }
  document.addEventListener('visibilitychange', handleVisibilityChange);
  // ...
}, [request]);
```

The `wasActiveRef` flag tracks whether the user intentionally requested the wake lock (i.e., a workout is active). We only re-acquire if the lock was supposed to be held. The hook also gracefully degrades -- if the Wake Lock API is not available (older browsers, Firefox on desktop), it logs a warning and the app works fine without it.

---

## Bonus: Patterns Worth Knowing

### The Import Transaction

The import function replaces ALL data in a single Dexie transaction. If anything fails -- a validation error, a corrupt record, a storage quota issue -- the entire operation rolls back and the user's existing data is untouched:

```typescript
await db.transaction('rw', [db.exercises, db.templates, db.logs, ...], async () => {
  await Promise.all([db.exercises.clear(), db.templates.clear(), ...]);
  if (parsed.exercises.length > 0) await db.exercises.bulkAdd(parsed.exercises);
  // ...
});
```

### The Haptics Hook

The `useHaptics` hook wraps the Vibration API with different patterns for different interactions:

```typescript
tap: () => vibrate(50);           // Light touch feedback
press: () => vibrate(100);        // Button press
timerComplete: () => vibrate([200, 100, 200]);  // Buzz-pause-buzz
success: () => vibrate([100, 50, 100, 50, 200]); // Celebration pattern
```

All patterns are gated behind the `hapticFeedback` setting. If the user disables haptics, every function becomes a no-op. If the browser does not support the Vibration API (desktop Chrome, for example), the `vibrate` call is silently ignored.

### The Epley 1RM Estimator

The app estimates your one-rep max using the Epley formula, which is the industry standard for sets of 12 reps or fewer:

```typescript
export function calculateEpley1RM(weightG: number, reps: number): number | null {
  if (reps > 12 || reps <= 0 || weightG <= 0) return null;
  if (reps === 1) return weightG;
  return Math.round(weightG * (1 + reps / 30));
}
```

The `null` return for reps > 12 is intentional. The Epley formula becomes increasingly inaccurate above 12 reps, so we do not show an estimate rather than show a misleading one.

### Denormalized Exercise History

When a workout is saved, we do not just store the log. We also write denormalized `ExerciseHistoryEntry` records that aggregate per-exercise metrics (best weight, total volume, estimated 1RM, total sets, total reps). This pre-computation means the progress charts can query a single table with a compound index instead of scanning every log and filtering every set.

It is a classic read-optimized pattern: write a little more at save time, read a lot faster at query time. Since workouts are saved infrequently (a few times per week) but charts are browsed often, this tradeoff pays off.

---

## File Quick Reference

| File | What It Does | Lines |
|------|-------------|-------|
| `src/types/workout.ts` | Every interface, constant, and default | ~198 |
| `src/lib/stepEngine.ts` | Template blocks to flat step array | ~195 |
| `src/lib/db.ts` | Dexie database with 7 typed tables | ~38 |
| `src/lib/calculations.ts` | Weight math, 1RM, formatting | ~136 |
| `src/lib/queries.ts` | Dexie query helpers using compound indexes | ~123 |
| `src/stores/activeWorkoutStore.ts` | In-progress workout state machine | ~306 |
| `src/workers/timer.worker.ts` | Web Worker countdown timer | ~73 |
| `src/hooks/useTimer.ts` | React hook wrapping the timer worker | ~220 |
| `src/hooks/useWakeLock.ts` | Screen wake lock with visibility recovery | ~106 |
| `src/lib/achievements.ts` | 7 achievements with async check functions | ~164 |
| `src/lib/exportImport.ts` | JSON export, transactional import, preview | ~183 |
