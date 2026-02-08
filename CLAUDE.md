# CLAUDE.md — Workout PWA

## Project Overview
Local-first Progressive Web App for tracking weight-training workouts. No accounts, no servers, no cloud. All data lives in IndexedDB on the user's device.

## Tech Stack
- **Framework:** Next.js 16 (static export) + React 19 + TypeScript strict
- **State:** Zustand v5 (always use selectors — `useStore((s) => s.field)`)
- **Storage:** Dexie v4 (IndexedDB) + sessionStorage (crash recovery)
- **Styling:** Tailwind CSS v4, dark-first design tokens in `globals.css`
- **Charts:** Recharts (lazy-loaded via `next/dynamic`)
- **PWA:** Serwist v9 (service worker, offline caching)
- **Icons:** Lucide React
- **Testing:** Vitest + Playwright

## Commands
- `npm run dev` — Dev server
- `npm run build` — Production build
- `npm run lint` / `npm run lint:fix` — ESLint (`npx eslint . --max-warnings 0`)
- `npm run typecheck` — TypeScript check
- `npm run test` — Vitest
- `npm run e2e` — Playwright

## Architecture Rules
- **Types first:** `src/types/workout.ts` is the single source of truth
- **One-way deps:** types -> lib -> stores -> hooks -> components -> app
- **Integer grams:** All weights stored as integer grams, converted at display boundary
- **Snapshot pattern:** Templates are deep-copied when a workout starts; history is immutable
- **Zustand v5:** NEVER call `useStore()` without a selector — causes full-tree re-renders

## Key Directories
- `src/app/` — Next.js App Router pages
- `src/components/ui/` — Reusable primitives (Button, Card, Toast, etc.)
- `src/components/active/` — Active workout screens
- `src/components/history/` — History and charts
- `src/components/workout/` — Template editing
- `src/components/layout/` — AppShell, Header, BottomTabBar
- `src/lib/` — Pure logic (no React imports)
- `src/stores/` — Zustand stores
- `src/hooks/` — Custom hooks (timer, haptics, wake lock)
- `src/workers/` — Web Worker for timer

---

## Design Context

### Users
Intermediate weight lifters who already know their exercises and programs. They're using this app **at the gym**, between sets, with sweaty hands and divided attention. They want a fast, reliable tool that tracks their work without getting in the way — then gives them a satisfying sense of accomplishment when they're done. They don't need hand-holding or exercise tutorials. They need speed, clarity, and data they can trust.

### Brand Personality
**Bold. Focused. Satisfying.**

Like a good gym session itself — intense when it needs to be, rewarding when you're done. The interface should feel like a precision instrument with soul. Not cold and clinical, but not bubbly either. Think Apple Fitness+ energy: premium feel, polished animations, meaningful celebration moments — but grounded in real data and real results.

The voice is confident and direct. Short labels. No filler copy. Celebrate wins with impact, not with words.

### Aesthetic Direction
- **Visual tone:** Dark, high-contrast, amber-accented. The dark theme (#0A0A0B background) is the primary identity — warm amber (#F59E0B) cuts through with purpose.
- **Reference:** Apple Fitness+ — the way it celebrates ring closures, shows smooth progress animations, and makes completing something feel genuinely rewarding.
- **Anti-references:** Overly social/gamified apps (Hevy-style leaderboards), anything with pastel colors or rounded bubbly shapes that feel unserious, generic Material Design with no personality.
- **Theme:** Dark mode is the identity. Light mode should exist but dark is the soul.
- **Typography:** Inter for UI, DM Mono for numbers. Tabular nums everywhere data lives.
- **Motion:** Custom easing curves (expo-out, quart-out, back-out). Animations should feel physical — things have weight and spring, not just opacity fades.

### Design Principles

1. **Gym-proof first.** Every interaction must work with one thumb, mid-set, with sweat on the screen. Touch targets are generous (44px+). Critical actions (DONE, SKIP) are oversized. Nothing requires precision tapping.

2. **Celebrate the work.** Completing a workout is the emotional peak. Achievement unlocks, workout complete animations, PR recognition — these moments should feel *earned*. Use motion, sound, and haptics together. But keep celebrations brief (< 2 seconds) — they're at the gym, not watching fireworks.

3. **Data is the product.** Progress charts, historical weights, estimated 1RM — this is why people come back. Present data clearly with proper typography (monospace numbers, tabular-nums, consistent formatting). Never sacrifice data density for aesthetics.

4. **Motion with purpose.** Every animation communicates state: exercise slides in from right (forward progress), rest timer pulses (urgency), bottom sheets spring up (physicality). No animation exists purely for decoration. Respect `prefers-reduced-motion`.

5. **Invisible until needed.** The best UI during a workout is nearly no UI. The exercise name, the rep target, and the DONE button. During rest, the timer ring and the skip button. Strip everything else. Complexity lives in settings and history — not in the active workout flow.

### Existing Animation Vocabulary
The app has a mature animation system in `globals.css`:
- **Entrances:** fade-in-up (lists), slide-up-spring (bottom sheets), scale-in (modals), exercise-enter (workout transitions), rest-enter (timer transitions)
- **Feedback:** check-pop (success), value-pop (stepper changes), flash (countdown final seconds)
- **Ambient:** pulse-glow (CTA buttons), timer-pulse (countdown urgency), float (empty states), shimmer (achievements), tab-active-glow (navigation)
- **Easing:** `--ease-expo-out`, `--ease-quart-out`, `--ease-back-out`
- **Stagger:** 8 delay tiers at 60ms intervals
- **Accessibility:** All animations disabled under `prefers-reduced-motion: reduce`

### Color System
| Token | Value | Purpose |
|-------|-------|---------|
| `background` | `#0A0A0B` | Page canvas |
| `surface` | `#111113` | Cards, inputs |
| `elevated` | `#1A1A1D` | Sheets, dialogs, toasts |
| `accent` | `#F59E0B` | Primary CTAs, active states |
| `success` | `#22C55E` | Completions, timer >66% |
| `warning` | `#F59E0B` | Partial states, timer 33-66% |
| `danger` | `#EF4444` | Deletes, errors, timer <33% |
| `text-primary` | `#FFFFFF` | Headings, primary content |
| `text-secondary` | `#ADADB0` | Descriptions, secondary labels |
| `text-muted` | `#6B6B70` | Placeholders, hints |
| `border` | `#2A2A2E` | Dividers, card borders |

### Feedback Layers
The app uses multi-sensory feedback for important actions:
- **Visual:** Color changes, animations, icon swaps
- **Haptic:** Vibration patterns (tap: 50ms, press: 100ms, timer-complete: [200,100,200], success: [100,50,100,50,200])
- **Audio:** Sound effects (timer beep, timer done, workout complete celebration)
All gated behind user settings. Always degrade gracefully.
