---
title: "Extract templateSnapshot into Separate IndexedDB Table"
type: refactor
date: 2026-02-09
---

# Extract templateSnapshot into Separate IndexedDB Table

## Overview

Every `WorkoutLog` in IndexedDB currently carries a full deep-copy of its template (`templateSnapshot: TemplateBlock[]`) — exercise definitions, set targets, rest timers, superset structure. For a user with 200 workouts using the same 8-exercise template, that's 200 identical copies deserialized on every history page load.

**No UI ever reads `templateSnapshot` from the database.** The only consumer is the `superset-master` achievement check, which reads the in-memory log object at completion time — not a DB fetch.

Move `templateSnapshot` into its own `logSnapshots` table keyed by `logId`. The `logs` table becomes lean, history/progress queries skip the snapshot blob entirely, and the data is still available on-demand for future features.

## Problem Statement

IndexedDB has no column-level projection — reading a row deserializes the entire object. Two hot paths currently pay the full `templateSnapshot` deserialization cost for every log:

1. **History page** (`src/app/history/page.tsx:154`): `db.logs.orderBy('startedAt').reverse().toArray()` — loads ALL logs, uses only `templateName`, `startedAt`, `durationSec`, `totalVolumeG`, `performedSets.length`, `status`
2. **Progress stats** (`src/app/progress/page.tsx:79`): `db.logs.each()` — iterates ALL logs, uses only `durationSec`

Both paths load `templateSnapshot` (a nested array of `ExerciseBlock | SupersetBlock`) on every row and immediately discard it.

## Proposed Solution

### New Table: `logSnapshots`

| Field | Type | Purpose |
|-------|------|---------|
| `logId` (PK) | `string` | Foreign key to `logs.id` |
| `templateSnapshot` | `TemplateBlock[]` | The frozen template deep-copy |

### Schema Migration (v4 → v5)

Dexie version bump to 5. The `upgrade()` function:
1. Iterates all existing log rows
2. For each log with a `templateSnapshot`, writes `{ logId: log.id, templateSnapshot: log.templateSnapshot }` to `logSnapshots`
3. Deletes `templateSnapshot` from the log row
4. Skips logs that already lack `templateSnapshot` (defensive)

Follows the existing v4 migration pattern in `db.ts:65-98`.

### Type Strategy

Make `templateSnapshot` **optional** on `WorkoutLog`:

```typescript
// src/types/workout.ts
export interface WorkoutLog {
  // ... existing fields ...
  templateSnapshot?: TemplateBlock[];  // optional — only present in-memory at completion time
}

export interface LogSnapshot {
  logId: string;
  templateSnapshot: TemplateBlock[];
}
```

The `completeWorkout()` function builds the log object in memory WITH `templateSnapshot` (from the Zustand store), passes it to `checkAchievements(log)` and `detectPersonalRecords(log)`, then strips `templateSnapshot` before persisting to the `logs` table and writes it separately to `logSnapshots`.

### Export/Import Strategy

**Export:** Re-join snapshots onto logs during export so the file format stays backward-compatible. Keep `schemaVersion: 1`. An export from the new code is importable by old code.

**Import:** Check each incoming log for inline `templateSnapshot`. If present, split it out to `logSnapshots`. This handles both old exports (pre-migration, inline snapshots) and new exports (re-joined snapshots). No special handling needed since the format is identical.

## Technical Approach

### Files to Change

| File | Change | Why |
|------|--------|-----|
| `src/types/workout.ts` | Make `templateSnapshot` optional on `WorkoutLog`; add `LogSnapshot` interface; add `LogSnapshot` to `ExportData` (no — keep export format unchanged) | Type foundation |
| `src/lib/db.ts` | Add `logSnapshots` table to class; declare v5 schema; write `upgrade()` function | Schema migration |
| `src/stores/activeWorkoutStore.ts` | `completeWorkout()`: write log (sans snapshot) and snapshot in a Dexie transaction; return full in-memory log to caller | Write path |
| `src/lib/queries.ts` | `deleteLog()`: also delete from `logSnapshots` in a transaction; `deleteAllData()`: add `logSnapshots` to table list + clear; `deleteDataByDateRange()`: bulk-delete matching snapshots; add `getLogSnapshot(logId)` helper | Delete + read paths |
| `src/lib/exportImport.ts` | Export: load both tables, re-join snapshots onto logs; Import: split `templateSnapshot` from incoming logs into `logSnapshots`; add `logSnapshots` to transaction table list | Backward-compatible export/import |
| `src/lib/validation.ts` | Make `templateSnapshot` validation lenient for the optional case (import logs may have it inline or not) | Import validation |

### Files NOT Changed (Confirmed Safe)

| File | Why Safe |
|------|----------|
| `src/app/history/page.tsx` | Already only uses lean fields; benefits automatically |
| `src/app/history/[id]/page.tsx` | Detail page uses `performedSets`, not `templateSnapshot` |
| `src/app/progress/page.tsx` | Only uses `durationSec`; benefits automatically |
| `src/lib/achievements.ts` | `superset-master` reads in-memory log object from `completeWorkout()` return — no DB read |
| `src/lib/personalRecords.ts` | Reads `performedSets` only |
| `src/stores/activeWorkoutStore.ts` crash recovery | `CrashRecoveryData` stores active session's `templateSnapshot` in `crashRecovery` table — separate concern, unchanged |
| `src/app/workout/[id]/page.tsx` | Receives full in-memory log from `completeWorkout()`, passes to achievement check — no changes needed |

### Implementation Phases

#### Phase 1: Types + Schema (Foundation)

1. **`src/types/workout.ts`** — Make `templateSnapshot` optional on `WorkoutLog`; add `LogSnapshot` interface
2. **`src/lib/db.ts`** — Add `logSnapshots!: Table<LogSnapshot, string>` property; declare v5 schema (all existing tables unchanged + `logSnapshots: 'logId'`); write upgrade function

The upgrade function pattern (following v4 precedent):
```typescript
.version(5)
.stores({
  // ... all existing table schemas unchanged ...
  logSnapshots: 'logId',
})
.upgrade(async (tx) => {
  const logs = tx.table('logs');
  const snapshots = tx.table('logSnapshots');

  await logs.toCollection().modify(async (log) => {
    if (Array.isArray(log.templateSnapshot)) {
      await snapshots.add({
        logId: log.id,
        templateSnapshot: log.templateSnapshot,
      });
      delete log.templateSnapshot;
    }
  });
});
```

#### Phase 2: Write Path

3. **`src/stores/activeWorkoutStore.ts`** — In `completeWorkout()`:
   - Build the full in-memory `WorkoutLog` (with `templateSnapshot`) as before
   - Create a lean copy without `templateSnapshot` for DB storage
   - Use a Dexie `rw` transaction to atomically write to `db.logs` and `db.logSnapshots`
   - Return the full in-memory log (with snapshot) to the caller so `checkAchievements(log)` and `detectPersonalRecords(log)` continue to work unchanged

```typescript
const { templateSnapshot, ...leanLog } = log;
await db.transaction('rw', [db.logs, db.logSnapshots], async () => {
  await db.logs.add(leanLog);
  await db.logSnapshots.add({ logId: log.id, templateSnapshot });
});
// Return full log (with templateSnapshot) for in-memory consumers
return log;
```

#### Phase 3: Delete Paths

4. **`src/lib/queries.ts`** — Update all delete operations:

   - `deleteLog(logId)`: Wrap in transaction, add `db.logSnapshots.delete(logId)`
   - `deleteAllData()`: Add `db.logSnapshots` to transaction table list, add `db.logSnapshots.clear()`
   - `deleteDataByDateRange()`: After collecting `logIds`, add `db.logSnapshots.bulkDelete([...logIds])`
   - Add new helper: `getLogSnapshot(logId): Promise<TemplateBlock[] | null>` for future use

#### Phase 4: Export/Import

5. **`src/lib/exportImport.ts`** — Export:
   - Load `db.logs.toArray()` and `db.logSnapshots.toArray()` in parallel
   - Build a `Map<string, TemplateBlock[]>` from snapshots
   - Re-join: for each log, set `log.templateSnapshot = snapshotMap.get(log.id) ?? []`
   - Return the re-joined logs in the `ExportData` envelope (format unchanged, `schemaVersion: 1`)

6. **`src/lib/exportImport.ts`** — Import:
   - Add `db.logSnapshots` to the transaction table list
   - Add `db.logSnapshots.clear()` to the table clearing step
   - Before `db.logs.bulkAdd()`: iterate each log, extract `templateSnapshot`, collect into a `LogSnapshot[]` array, delete `templateSnapshot` from the log
   - After `db.logs.bulkAdd()`: call `db.logSnapshots.bulkAdd(snapshots)`

7. **`src/lib/validation.ts`** — Make `templateSnapshot` handling lenient:
   - `validateImportLog()`: Still validate `templateSnapshot` if present, but don't require it
   - `stripLog()`: Only copy `templateSnapshot` if it exists on the source object

#### Phase 5: Tests

8. **`src/lib/__tests__/`** — Update existing test fixtures that construct `WorkoutLog` objects to make `templateSnapshot` optional. Add new tests:

   - **Migration test:** Create a mock v4 database, run the v5 upgrade, verify logs are lean and `logSnapshots` has the correct data
   - **Write path test:** `completeWorkout()` writes to both tables; returned log has `templateSnapshot`; DB log does not
   - **Delete tests:** Each delete function also removes from `logSnapshots`
   - **Export test:** Exported logs have `templateSnapshot` re-joined
   - **Import test (old format):** Logs with inline `templateSnapshot` are correctly split
   - **Edge case test:** Migration skips logs that have no `templateSnapshot`

## Edge Cases & Risks

### Migration Risks

| Risk | Mitigation |
|------|-----------|
| **Large DB migration blocking main thread** (1000+ logs) | Dexie upgrade transactions are synchronous within the IDB transaction. For most users (< 500 logs), this completes in < 1 second. For extreme cases, the one-time cost is acceptable. No progress indicator (Dexie runs before React renders). |
| **Browser crash mid-migration** | Dexie upgrade transactions are atomic — on crash, IDB rolls back the entire upgrade. The DB stays at v4 and re-runs the migration on next load. |
| **Safari WebKit "blocked" state after failed upgrade** | Extremely rare edge case. Document in troubleshooting that clearing site data resolves it. Users should export data regularly. |

### Service Worker Timing

| Risk | Mitigation |
|------|-----------|
| **Stale SW serves old code against migrated v5 DB** | Serwist uses `skipWaiting` by default, so the new SW activates immediately on install. The window between SW update check and activation is narrow (milliseconds). If old code does run, `log.templateSnapshot` will be `undefined` — the history page doesn't read it (safe), and the only consumer (`superset-master` achievement) only runs at completion time from an in-memory object (safe). |

### Data Integrity

| Risk | Mitigation |
|------|-----------|
| **Orphaned `logSnapshots` rows** (log deleted, snapshot remains) | All delete paths are wrapped in transactions that delete from both tables. |
| **Missing `logSnapshots` rows** (log exists, snapshot doesn't) | `getLogSnapshot()` returns `null`. Future UI that needs the snapshot handles the null case gracefully. |
| **Non-atomic write at completion** | `completeWorkout()` uses a Dexie `rw` transaction wrapping both table writes. If either fails, both roll back. |

### Type Safety

| Concern | Resolution |
|---------|-----------|
| **`templateSnapshot` is optional but achievement check reads it** | The achievement check receives the in-memory log (with snapshot) from `completeWorkout()` return value. It never reads from DB. The TypeScript narrowing is handled at the call site. |
| **Export type vs DB type** | The export format always includes `templateSnapshot` (re-joined). The `ExportData.logs` type uses `WorkoutLog` — since `templateSnapshot` is optional, this works. The export function guarantees it is populated. |

## Acceptance Criteria

### Functional Requirements

- [ ] Dexie schema bumps from v4 to v5 with `logSnapshots` table
- [ ] Existing logs migrate: `templateSnapshot` moves to `logSnapshots`, removed from `logs` rows
- [ ] `completeWorkout()` writes to both tables atomically in a transaction
- [ ] `completeWorkout()` returns full in-memory log (with `templateSnapshot`) for achievement checks
- [ ] `deleteLog()` removes from both `logs` and `logSnapshots`
- [ ] `deleteAllData()` clears `logSnapshots`
- [ ] `deleteDataByDateRange()` deletes matching `logSnapshots`
- [ ] Export re-joins snapshots onto logs; exported format is unchanged (`schemaVersion: 1`)
- [ ] Import splits inline `templateSnapshot` from logs into `logSnapshots`
- [ ] Import handles old exports (inline snapshots) and new exports (re-joined snapshots) identically
- [ ] Crash recovery is unaffected (stores active session's `templateSnapshot` in `crashRecovery` table)
- [ ] `getLogSnapshot(logId)` helper returns `TemplateBlock[] | null`

### Non-Functional Requirements

- [ ] History page query (`db.logs.orderBy().toArray()`) no longer deserializes `templateSnapshot`
- [ ] Progress stats query (`db.logs.each()`) no longer deserializes `templateSnapshot`
- [ ] Migration completes in < 2 seconds for 500 logs (typical heavy user)
- [ ] No TypeScript errors (`npm run typecheck` passes)
- [ ] Lint passes (`npm run lint`)
- [ ] All existing tests pass (`npm run test`)

### Quality Gates

- [ ] New unit tests for migration, write path, delete paths, export, import
- [ ] Edge case test: migration handles logs without `templateSnapshot`
- [ ] Build succeeds (`npm run build`)

## References

### Internal References

- Database setup: `src/lib/db.ts` (lines 1-98, v4 migration pattern at lines 65-98)
- WorkoutLog type: `src/types/workout.ts` (lines 87-98)
- Write path: `src/stores/activeWorkoutStore.ts` (lines 188-244, `completeWorkout()`)
- Achievement check: `src/lib/achievements.ts` (line 155, `superset-master`)
- History query: `src/app/history/page.tsx` (line 154)
- Progress query: `src/app/progress/page.tsx` (line 79)
- Delete operations: `src/lib/queries.ts` (lines 143-267)
- Export/Import: `src/lib/exportImport.ts` (lines 131-298)
- Validation: `src/lib/validation.ts` (lines 546, 793-810)
- Crash recovery: `src/stores/activeWorkoutStore.ts` (lines 251-288)

### Design Documents

- CLAUDE.md architecture rules: `src/types/workout.ts` is single source of truth
- Snapshot pattern: templates are deep-copied at workout start; history is immutable
- Integer grams: all weights stored as integer grams, converted at display boundary
