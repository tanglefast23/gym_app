# UI.md — Complete Design Specification for Workout PWA

> **Purpose:** This document tells a design-focused LLM everything it needs to fully create all UX/UI visuals for this project. It covers every page, every component, every state, every interaction, and how they all connect.

---

## 1. Design System

### 1.1 Color Tokens (Dark Theme — Primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `background` | `#0A0A0B` | Page backgrounds, root canvas |
| `surface` | `#111113` | Cards, input backgrounds, secondary containers |
| `elevated` | `#1A1A1D` | Bottom sheets, dialogs, toasts, elevated panels |
| `accent` | `#F59E0B` | Primary actions, active tab, links (amber) |
| `success` | `#22C55E` | Success toasts, timer ring (>66% remaining) |
| `warning` | `#F59E0B` | Partial badges, timer ring (33-66% remaining) |
| `danger` | `#EF4444` | Delete actions, error toasts, timer ring (<33% remaining) |
| `text-primary` | `#FFFFFF` | Headings, primary content |
| `text-secondary` | `#ADADB0` | Subtext, descriptions, secondary labels |
| `text-muted` | `#6B6B70` | Placeholders, hints, tertiary info |
| `border` | `#2A2A2E` | Card borders, dividers, input borders |

### 1.2 Color Tokens (Light Theme)

| Token | Hex |
|-------|-----|
| `background` | `#FFFFFF` |
| `surface` | `#F4F4F5` |
| `elevated` | `#E4E4E7` |
| `text-primary` | `#0A0A0B` |
| `text-secondary` | `#52525B` |
| `text-muted` | `#A1A1AA` |
| `border` | `#D4D4D8` |

> Accent, success, warning, danger remain the same in both themes.

### 1.3 Typography

- **Font family:** Inter (system-ui fallback), DM Mono for numeric displays
- **Heading sizes:** `text-2xl` (page titles), `text-xl` (section headings), `text-lg` (card titles, dialog titles)
- **Body:** `text-sm` (most content), `text-xs` (metadata, timestamps, labels)
- **Weight scale:** `font-bold` (headings), `font-semibold` (card titles, buttons), `font-medium` (labels, tabs)
- **Monospace:** Timer displays use tabular-nums font-variant for fixed-width digits

### 1.4 Spacing & Sizing

- **Page padding:** `px-4` (16px horizontal)
- **Card padding:** `p-3` (sm), `p-4` (md), `p-6` (lg)
- **Border radius:** `rounded-xl` (12px — inputs, cards), `rounded-2xl` (16px — large cards, sheets), `rounded-full` (circular buttons)
- **Touch targets:** All interactive elements have minimum 44px height (`min-h-[44px]`)
- **Safe areas:** `env(safe-area-inset-top)` on header, `env(safe-area-inset-bottom)` on bottom tab bar

### 1.5 Icon System

- **Library:** Lucide React (outlined, 24px base, scaled to context)
- **Common icons:** Dumbbell, Play, Pencil, Copy, Trash2, ChevronLeft, ChevronRight, Search, Settings, History, PlusCircle, Clock, Layers, TrendingUp, X, Plus, Minus, SkipForward, ArrowLeft, Download, Upload, RotateCcw, GripVertical, AlertCircle, Loader2, Calendar, CopyCheck

---

## 2. Shared Components (Design Each of These)

### 2.1 Button

**Variants:**
- `primary` — Accent background (#F59E0B), white text
- `secondary` — Surface background with border, primary text
- `danger` — Red background (#EF4444), white text
- `ghost` — Transparent, secondary text, surface on hover

**Sizes:** `sm` (h-8), `md` (h-10), `lg` (h-12), `xl` (h-16)

**States:** Default, hover (opacity-90), active (scale 0.97), disabled (opacity-50), loading (spinner replaces content)

**Options:** `fullWidth`, icon + text combos, icon-only

### 2.2 Card

- Rounded-2xl container with surface background and border
- Clickable variant adds cursor-pointer and scale-98 on active
- Three padding options: sm (p-3), md (p-4), lg (p-6)

### 2.3 Bottom Sheet

- Slides up from bottom of screen
- Full-width, rounded-t-3xl, elevated background
- Drag handle bar at top (40px wide, 6px tall, border color, rounded-full)
- Optional title below handle
- Backdrop: black at 60% opacity, fades in
- Max height: 85vh with scroll
- Safe area padding at bottom

### 2.4 Confirm Dialog

- Centered modal overlay (black/60 backdrop)
- Rounded-2xl elevated panel, max-w-sm
- Title (text-lg font-semibold), optional description (text-sm text-secondary)
- Two buttons side by side: Cancel (secondary) + Confirm (primary or danger)
- Scale-up entrance animation (scale-95 to scale-100)

### 2.5 Toast

- Fixed top (centered), max-w-sm, full-width on mobile with side padding
- Rounded-xl, elevated background, border
- Icon indicates type:
  - Success: green icon
  - Error: red icon
  - Info: accent icon
- Text + dismiss X button
- Slides in from right (animation)
- Auto-dismisses after 3 seconds

### 2.6 Empty State

- Centered vertically in container
- Large icon (48x48, muted color)
- Title (text-lg, secondary color)
- Description (text-sm, muted, max-w-xs, centered)
- Optional action button below

### 2.7 Stepper (Weight/Reps Input)

- Horizontal layout: [-] button, value display, [+] button
- Circular buttons (56x56, surface bg, border)
- Value in center: text-2xl monospace
- Optional label above (text-sm, secondary)
- Disabled state at min/max (opacity-50)

### 2.8 NumberStepper (Compact, for Template Editor)

- Smaller inline stepper for sets/reps/rest editing
- Same minus/value/plus pattern but more compact
- Optional suffix (e.g., "s" for seconds)

### 2.9 Header

- Sticky top bar, 56px height
- Backdrop blur (bg-background/80 backdrop-blur-lg)
- Three-column layout: left action (48px), centered title (flex-1), right action (48px)
- Safe area top padding

### 2.10 Bottom Tab Bar

- Fixed bottom, full width
- Four tabs: Workouts (Dumbbell icon), Create (PlusCircle icon), Progress (TrendingUp icon), History (BarChart2 icon)
- 56px min height per tab
- Active tab: accent color, inactive: muted color
- Tab = icon + label (text-xs)
- Safe area bottom padding
- Hidden during active workout and settings pages

---

## 3. Pages — Full Specifications

### 3.1 Home Page (`/`)
**Route:** Root
**Tab bar:** Visible (Workouts tab active)
**Header:** None (inline h1 "Workouts")

**Layout top to bottom:**
1. **Page title:** "Workouts" — text-2xl font-bold, pt-6
2. **Continue Session Banner** (conditional — only if crash recovery data exists and < 4 hours old):
   - Rounded-2xl card with accent/10 background and accent/30 border
   - Text: "Continue workout?" + template name
   - Two buttons: "Resume" (primary sm) + "Dismiss" (ghost sm)
3. **Search Bar** (conditional — only shown when 5+ templates exist):
   - Search icon on left, rounded-xl input
   - Placeholder: "Search workouts..."
4. **Template Cards** — vertical list, each is a `WorkoutCard`:
   - Template name (text-lg, truncated)
   - Stats row: exercise count (Dumbbell icon) + estimated duration (Clock icon)
   - "Last performed: today/yesterday/X days ago/Never performed"
   - ChevronRight on right side
   - Tap opens Bottom Sheet
5. **Empty State** — when no templates:
   - Dumbbell icon (48x48)
   - "No workouts yet"
   - "Create your first workout template to get started"
   - "Create Workout" button (primary, lg)
6. **No Results State** — when search matches nothing:
   - Search icon, "No results", "No workouts match [query]"

**Bottom Sheet (on card tap):**
- Title: template name
- Actions list:
  - Play icon (accent) + "Start Workout" (accent text)
  - Pencil icon + "Edit"
  - Copy icon + "Duplicate"
  - Trash2 icon (danger) + "Delete" (danger text)
- Delete triggers Confirm Dialog

**Navigation from this page:**
- Tap card → Bottom Sheet → "Start Workout" → `/workout/[id]`
- Tap card → Bottom Sheet → "Edit" → `/edit/[id]`
- "Create Workout" button / Create tab → `/create`
- History tab → `/history`
- Resume banner → `/workout/[id]`

---

### 3.2 Create Workout Page (`/create`)
**Route:** `/create`
**Tab bar:** Visible (Create tab active)
**Header:** "Create Workout" with back chevron

**Layout:**
1. **Workout Name Input:**
   - Label: "Workout Name"
   - Rounded-xl input, surface bg, placeholder "Workout name"
   - Max 100 characters
2. **Exercise Blocks** — vertical list of editors (see ExerciseBlockEditor / SupersetBlockEditor below)
3. **Add Block Buttons** — two buttons side by side:
   - "Add Exercise" (secondary, Dumbbell icon) — 50% width
   - "Add Superset" (secondary, Layers icon) — 50% width
4. **Validation Errors** (conditional):
   - Red-bordered card with danger/10 background
   - "Please fix the following:" heading
   - Bulleted list of errors
5. **Sticky Save Button** — fixed bottom (above tab bar):
   - Full-width, lg, primary
   - Plus icon + "Save Workout"
   - Background blur bar with border-t

**ExerciseBlockEditor Component:**
- Rounded-2xl surface card with border
- Header row: GripVertical (drag handle) + "Exercise" label + Trash2 delete button
- ExerciseAutocomplete input (search icon, autocomplete dropdown)
- Sets stepper + Reps min-max steppers (with dash between)
- Rest override: checkbox + conditional NumberStepper (suffix "s")

**SupersetBlockEditor Component:**
- Same as ExerciseBlock but with indigo left border (4px)
- "Superset" badge (accent/20 bg, accent text, rounded-full)
- Shared "Sets (all exercises)" stepper
- List of exercise rows (each with autocomplete + reps steppers)
- "Add Exercise" ghost button
- Bottom section: rest between exercises stepper + rest between rounds stepper

**ExerciseAutocomplete:**
- Search icon in input
- Dropdown below: list of matching exercise names from database
- Elevated background, border, shadow, max-h-64 scroll

**Navigation:**
- Back chevron → previous page
- Save → redirects to `/`

---

### 3.3 Edit Workout Page (`/edit/[id]`)
**Route:** `/edit/[id]`
**Tab bar:** Visible
**Header:** "Edit Workout" with back chevron

**Identical layout to Create page except:**
- Pre-populated with template data from database
- Save button says "Update Workout" (Save icon instead of Plus)
- Loading state: centered Loader2 spinner
- Not found state: AlertCircle icon, "Workout not found", "Back to Home" button

---

### 3.4 Active Workout Page (`/workout/[id]`)
**Route:** `/workout/[id]`
**Tab bar:** HIDDEN
**Header:** Custom (not shared Header component)

This is a full-screen immersive experience with **three phases:**

#### Phase 1: Active Workout
**Top bar:**
- X button (rounded-full, left side) — triggers quit confirmation
- Progress text: "3 / 12" (current exercise step / total) — right side

**Main content alternates between two views based on step type:**

**A. Exercise Step (`ExerciseDisplay`):**
- Centered vertical layout
- **Superset badge** (conditional): "SUPERSET" pill (accent/20 bg) + "Exercise 1 of 2"
- **Exercise name:** text-2xl font-bold, centered
- **Visual placeholder:** 120x120 rounded-2xl surface box with Dumbbell icon (48x48, muted)
  - **DESIGN NEEDED:** This is where exercise illustrations should go. The `visualKey` field on each exercise maps to an illustration asset. Currently shows a generic dumbbell. **Design ~15-20 exercise illustration assets** (see Section 5.1)
- **Set indicator:** "Set 2 of 4" (text-lg, secondary)
- **Rep target:** "8-12 reps" (text-3xl, bold, accent color)
- **DONE button:** Full-width, xl size, rounded-2xl, bold text — pinned to bottom

**B. Rest Step (`RestTimer`):**
- Centered vertical layout
- **Label:** "REST" or "SUPERSET REST" (text-lg, semibold, accent, tracking-wider)
- **Timer Ring** (`TimerRing` — 200px SVG circle):
  - Background ring: muted stroke
  - Progress ring: animates clockwise depletion
  - Color changes: green (>66%), amber (33-66%), red (<33%)
  - Center: time display in MM:SS format, text-4xl mono bold
  - Pulse animation when <= 3 seconds remaining (scale 1.0 → 1.05)
  - **DESIGN NEEDED:** Design this ring animation in detail — it's the most visually prominent element during workouts
- **Control buttons row:**
  - [-10] circle button (56x56) — surface bg, border
  - [Skip] pill button — accent bg, white text, SkipForward icon
  - [+10] circle button (56x56) — surface bg, border
- **Next up preview:** Rounded-xl surface box, centered text — "Next: Squat - Set 1"

**Quit Confirmation Dialog:**
- "End workout early?"
- "Your progress will be saved. You can log weights for completed sets."
- Cancel + "End Workout" (danger)

#### Phase 2: Weight Recap (`WeightRecap`)
**Full-screen view for logging weights after all exercises are done.**

- **Title:** "Log Your Weights" (text-2xl, bold, centered)
- **Progress:** "5/12 sets logged" (text-sm, secondary)
- **Set Card** (one at a time, navigable):
  - Rounded-2xl surface background
  - Exercise name (text-lg, semibold)
  - "Set 2 of 4" (text-sm, secondary)
  - **Weight stepper** (large Stepper component with unit label)
  - **Reps stepper** (standard Stepper)
  - **Quick actions row:**
    - "Same weight" button (CopyCheck icon) — copies from previous set
    - "Apply to remaining" button (Copy icon) — fills all remaining sets for this exercise
- **Navigation row:** Previous (secondary) + Next (primary) with chevron icons
- **Save buttons:**
  - "Save Workout" (primary, full-width) — only when all sets logged
  - "Save Partial" (ghost, full-width) — always available

#### Phase 3: Workout Complete (`WorkoutComplete`)
- Centered celebration layout
- **Animated checkmark:** 96x96 circle (accent bg) with SVG checkmark that draws on (stroke-dasharray animation, 0.6s ease-out)
  - **DESIGN NEEDED:** Polish this animation — consider adding particle effects or a subtle glow
- **Title:** "Workout Complete!" (text-2xl, bold)
- **Stats grid** (2 columns):
  - Duration (Clock icon + formatted time + "Duration" label)
  - Total Sets (Layers icon + count + "Total Sets" label)
  - Total Volume (Weight icon + formatted weight + "Total Volume" label) — spans both columns
- **Done button:** Full-width, lg

**Navigation:**
- Done → redirects to `/`

---

### 3.5 History Page (`/history`)
**Route:** `/history`
**Tab bar:** Visible (History tab active)
**Header:** "History" with Settings gear icon (right action)

**Layout:**
1. **Achievements Section:**
   - Section title: "ACHIEVEMENTS" (text-sm, uppercase, tracking-wider, muted)
   - Horizontal scrolling row of `AchievementCard` components
   - Scrollbar hidden, overflow-x-auto with negative margins for edge-to-edge feel

2. **Search Filter** (conditional — when logs exist):
   - Same search bar design as home page

3. **Grouped Log Entries:**
   - Date group header: "Today" / "Yesterday" / "Feb 8, 2026" (text-xs, uppercase, muted)
   - `LogCard` components within each group

**AchievementCard:**
- 120px min-width, shrink-0 (horizontal scroll item)
- Emoji icon (text-2xl) — grayscale + opacity-30 when locked
- Name (text-sm, font-medium)
- Description (text-xs, muted)
- Unlocked: accent/30 border, full color emoji
- Locked: border only, dimmed
- Context text and unlock date shown for unlocked achievements
- **7 achievements to design badges/visuals for:**
  1. First Blood (complete first workout)
  2. Century Club (100+ total sets)
  3. Iron Will (5 workouts in a week)
  4. Volume King (10,000+ kg total volume)
  5. Consistency (workout 3+ days in a row)
  6. Heavy Hitter (lift 100+ kg on any exercise)
  7. Dedicated (complete 25+ workouts)

**LogCard:**
- Card component with mb-3 spacing
- Template name (font-semibold, truncated) + optional "Partial" badge (warning/15 bg, warning text)
- Date (text-xs, muted)
- Stats row: duration (Clock) + set count (Layers) + volume (TrendingUp)
- Exercise summary: Dumbbell icon + "Bench Press, Squat +2 more"

**Empty state:** ClipboardList icon, "No workouts yet", "Complete your first workout..."
**No results:** Search icon, "No results"

**Navigation:**
- Tap LogCard → `/history/[id]`
- Settings icon → `/settings`
- Tap achievement → no navigation (info only)

---

### 3.6 Log Detail Page (`/history/[id]`)
**Route:** `/history/[id]`
**Tab bar:** Visible
**Header:** Date string (e.g., "Sat, Feb 8, 2026") with back arrow

**Layout:**
1. **Template name + status:** text-xl bold + optional "Partial" badge
2. **Summary stats grid** (3 columns):
   - Duration (Clock icon, value, "Duration" label) — in Card
   - Sets (Layers icon, count, "Sets" label) — in Card
   - Volume (TrendingUp icon, formatted weight, "Volume" label) — in Card
3. **Per-exercise sections:**
   - Exercise name (font-semibold) with Dumbbell icon + "View Details" link (accent text)
   - Table in Card:
     - Header: Set | Weight | Reps | Volume (right-aligned)
     - Rows: set number, weight+unit, reps done, set volume
     - Border-t between rows

**Navigation:**
- Back arrow → previous page
- "View Details" → `/history/exercise/[exerciseId]`

---

### 3.7 Exercise Detail Page (`/history/exercise/[id]`)
**Route:** `/history/exercise/[id]`
**Tab bar:** Visible
**Header:** Exercise name with back arrow

**Layout:**
1. **Quick stats grid** (3 columns):
   - Sessions count (Layers icon)
   - Best Weight (TrendingUp icon)
   - Estimated 1RM (TrendingUp icon, accent color) — shows "--" if no valid estimate
2. **Three charts** (stacked, each in a bordered Card):
   - "Estimated 1RM" — line chart
   - "Total Volume" — line chart
   - "Best Weight" — line chart
   - **DESIGN NEEDED:** Each chart is a Recharts `LineChart`:
     - Accent (#F59E0B) line, 2px stroke
     - Dots: 4px radius, accent fill, dark stroke
     - Active dot: 6px radius, white stroke
     - X-axis: MM/DD dates, muted color, no axis line
     - Y-axis: muted color, no axis line
     - Tooltip: elevated bg, border, rounded-lg — date + value
     - Height: 256px
     - "Need at least 2 sessions to show a chart" placeholder when < 2 data points
3. **Recent Sessions list:**
   - Section title: "RECENT SESSIONS"
   - Card containing rows:
     - Calendar icon + date + "X sets / Y reps" on left
     - Best weight + volume on right
     - Border-t between rows
   - Up to 20 entries, most recent first

**Empty state:** TrendingUp icon (48x48), "No history yet", "Complete a workout with this exercise to see progress"

---

### 3.8 Settings Page (`/settings`)
**Route:** `/settings`
**Tab bar:** HIDDEN
**Header:** "Settings" with back chevron (accent color)

**Layout — sections with setting rows:**

**Section: "UNITS & PREFERENCES"**
- Unit System: Segmented control [kg | lb]
- Default Rest: number input (right-aligned, 80px wide, suffix "seconds")
- Weight Steps (kg): display-only "1, 2.5, 5"
- Weight Steps (lb): display-only "2.5, 5, 10"

**Section: "FEEDBACK"**
- Haptic Feedback: Toggle switch
- Timer Sound: Toggle switch

**Section: "THEME"**
- Appearance: Segmented control [Dark | Light | System]

**Section: "DATA"**
- Export Data button (secondary, full-width, Download icon)
- Import Data button (secondary, full-width, Upload icon)
- **Import Preview Card** (conditional — after file selected):
  - "Import Preview" title
  - Summary: "X exercises, Y templates, Z logs, N achievements"
  - "Exported on [date]"
  - Warning text: "This will replace ALL existing data"
  - "Confirm Import" button (danger, sm)

**Section: "ABOUT"**
- "Workout PWA v0.1.0"
- "Local-only · No cloud sync · Your data stays on this device"

**Reset Settings button** (ghost, full-width, RotateCcw icon)

**Dialogs:**
- Import confirmation: "Replace all data?" (danger)
- Reset confirmation: "Reset settings?" (default)

**Custom sub-components to design:**
- **SettingRow:** Label (left) + control (right), with optional description
- **Toggle switch:** 44x24 pill, circle thumb slides left/right, accent when on
- **Segmented control:** Inline button group, rounded-lg, active segment has accent bg

---

### 3.9 Offline Page (`/~offline`)
**Route:** Service worker fallback
**Tab bar:** None
**Header:** None

- Centered full-screen layout
- Large emoji: satellite dish (text-6xl)
- "You're Offline" (text-2xl, bold)
- "Don't worry — your workout data is saved locally. Reconnect to the internet to continue browsing."
- **DESIGN NEEDED:** Consider designing a custom offline illustration instead of the emoji

---

## 4. Navigation Map

```
HOME (/)
├── [Tap card] → Bottom Sheet
│   ├── Start Workout → /workout/[id]  (FULL-SCREEN, no tab bar)
│   │   ├── Exercise steps ↔ Rest steps (auto-advance)
│   │   ├── Quit → Weight Recap phase
│   │   ├── Complete step → Weight Recap phase
│   │   │   └── Save → Workout Complete phase
│   │   │       └── Done → /
│   │   └── Resume on next app open (crash recovery)
│   ├── Edit → /edit/[id]
│   │   └── Save → /
│   ├── Duplicate → stays on /
│   └── Delete → Confirm Dialog → stays on /
├── [Create tab] → /create
│   └── Save → /
├── [History tab] → /history
│   ├── [Tap log] → /history/[id]
│   │   └── [View Details] → /history/exercise/[exerciseId]
│   └── [Settings icon] → /settings  (no tab bar)
└── [Resume banner] → /workout/[id]
```

---

## 5. Assets Needed (MUST DESIGN)

### 5.1 Exercise Illustration Set
The `ExerciseDisplay` component has a 120x120 visual placeholder that maps to `visualKey`. Currently shows a generic dumbbell icon. **Design illustrations for at least these common exercises:**

1. Bench Press
2. Squat
3. Deadlift
4. Overhead Press
5. Barbell Row
6. Pull-up / Lat Pulldown
7. Bicep Curl
8. Tricep Extension
9. Leg Press
10. Lunges
11. Shoulder Lateral Raise
12. Chest Fly
13. Calf Raise
14. Plank / Core
15. Default (generic exercise)

**Style requirements:**
- 120x120 viewbox, SVG preferred
- Should work on both dark (#111113) and light (#F4F4F5) surface backgrounds
- Minimal, line-art style matching Lucide icon aesthetic
- Single accent color (#F59E0B) for highlights is acceptable
- Must be visually distinct at a glance

### 5.2 PWA Icons
Located in `public/icons/` — currently empty. Need:
- `icon-192.png` (192x192) — referenced in manifest and apple-touch-icon
- `icon-512.png` (512x512) — for PWA install
- `icon-maskable-192.png` (192x192, maskable safe zone)
- `icon-maskable-512.png` (512x512, maskable safe zone)

**Style:** App icon should represent fitness/workout tracking. Accent (#F59E0B) primary color. Consider a stylized dumbbell or weight plate motif.

### 5.3 Achievement Badges (Optional Enhancement)
Currently achievements use emoji icons. Consider designing custom badge illustrations:
- First Blood: sword/crossed swords
- Century Club: "100" in bold
- Iron Will: flame
- Volume King: crown
- Consistency: chain links
- Heavy Hitter: lightning bolt
- Dedicated: star/medal

### 5.4 Splash / Onboarding (Not Yet Built)
No splash screen or onboarding flow exists. Consider designing:
- PWA install prompt card
- First-time user welcome screen
- Quick tutorial showing the template → workout → history flow

---

## 6. Animations & Micro-interactions

### 6.1 Timer Ring
- Smooth `stroke-dashoffset` transition (200ms ease-linear)
- Color transitions: green → amber → red based on remaining percentage
- Pulse animation at <= 3 seconds: `scale(1) → scale(1.05)` at 0.6s ease-in-out infinite

### 6.2 Checkmark Draw-On (Workout Complete)
- SVG polyline with `stroke-dasharray: 30` and `stroke-dashoffset: 30`
- Animates to `stroke-dashoffset: 0` over 0.6s ease-out with 0.3s delay
- Contained in a 96x96 accent-colored circle

### 6.3 Bottom Sheet
- Slide up: `translate-y-full → translate-y-0` (300ms ease-out)
- Backdrop: `bg-black/0 → bg-black/60` (300ms)

### 6.4 Confirm Dialog
- Scale entrance: `scale-95 opacity-0 → scale-100 opacity-100` (200ms)
- Backdrop fade (200ms)

### 6.5 Toast
- Slide from right: `translateX(100%) opacity(0) → translateX(0) opacity(1)` (300ms ease-out)

### 6.6 Button Press
- `active:scale-[0.97]` on all buttons
- `transition-all duration-150`

### 6.7 Reduced Motion
- All animations respect `prefers-reduced-motion: reduce` — durations set to 0.01ms

---

## 7. Responsive & Platform Considerations

### 7.1 Mobile-First
- Designed for 375px-428px width (iPhone SE through iPhone Pro Max)
- `display: standalone` PWA mode (no browser chrome)
- `viewport-fit: cover` for edge-to-edge
- Theme color: `#F59E0B` (accent)

### 7.2 Touch Optimizations
- `-webkit-tap-highlight-color: transparent` on all interactive elements
- `overscroll-behavior: contain` during active workouts (prevents pull-to-refresh)
- Wake lock keeps screen on during workouts

### 7.3 Safe Areas
- Top: header uses `pt-[env(safe-area-inset-top)]`
- Bottom: tab bar uses `pb-[env(safe-area-inset-bottom)]`
- Workout complete page uses `.safe-bottom` class

### 7.4 Status Bar
- Apple: `black-translucent` status bar style
- Theme color matches accent for warm-tinted status bar

---

## 8. States Checklist (Design Every State)

For every page, design these states:

| State | Pages That Have It |
|-------|--------------------|
| **Loading** | Home, History, Log Detail, Exercise Detail, Edit, Active Workout |
| **Empty** | Home (no templates), History (no logs), Exercise Detail (no history) |
| **Populated** | All pages |
| **Error** | Create/Edit (validation errors), toasts for runtime errors |
| **Search (no results)** | Home, History |
| **Not Found** | Log Detail, Edit (template deleted) |
| **Offline** | Dedicated offline fallback page |

---

## 9. Code Review Notes (for designer context)

The codebase is well-structured but the **visual layer is currently minimal**. The biggest design opportunities are:

1. **Exercise illustrations** — the 120x120 placeholder is the most prominent visual element during workouts and it's just a generic icon
2. **PWA icons** — `public/icons/` is empty, no app icon designed yet
3. **Timer ring** — functional but could be more visually striking with gradient strokes or glow effects
4. **Workout complete celebration** — just a checkmark, could have confetti, particles, or richer animation
5. **Achievement cards** — using emoji, could benefit from custom designed badges
6. **Charts** — functional Recharts setup, could use area fills, gradients, or better axis formatting
7. **Light theme** — token values are defined but visual polish in light mode is untested
8. **Empty states** — all use the same generic pattern, could have unique illustrations per context
9. **Onboarding** — no first-time user experience exists
10. **Template cards** — text-only, could benefit from color coding or visual differentiation
