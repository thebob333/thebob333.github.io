# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run typecheck    # TypeScript (vite build does NOT type-check)
npm run check        # lint + typecheck + tests
npm run test         # Run tests once
npm run test:watch   # Run tests in watch mode
npm run deploy       # Build + publish to GitHub Pages (https://thebob333.github.io/)
```

### Hosting

The live app is GitHub Pages: `origin` is `thebob333/thebob333.github.io`; source lives on `main`, and `npm run deploy` (`scripts/deploy-pages.sh`) force-pushes the built `dist/` to the `gh-pages` branch, adding `404.html` (so deep links like `/plan` load the app) and `.nojekyll`. It is served at the domain root, so no Vite `base` / router basename is needed. The old Lovable-connected repo (`bobbyTs-lab/goal-sculptor-engine`, remote `bobbyts`) is no longer updated.

To run a single test file:
```bash
npx vitest run src/path/to/file.test.ts
```

## Architecture

**TELOS** is a client-side-only React SPA for goal tracking and fitness. There is no backend — all data is persisted in `localStorage` via `src/lib/storage.ts`.

### Data Flow

User interaction → action (`goalActions`, `contactActions`, …) → `stores.X.update(prev => next)` → every subscribed component re-renders

- `src/lib/store.ts` — one shared, cached store per localStorage key (`get/set/update/subscribe`). Writes are try/catch-wrapped (quota → toast, cache unchanged), corrupt JSON is quarantined to `telos__corrupt:*`, other tabs sync via the `storage` event, and cached values are deep-frozen in dev (in-place mutation throws).
- `src/lib/storage.ts` — `KEYS`, all data types, and the `stores` map. The old `loadX/saveX` helpers are deprecated wrappers; ESLint blocks importing them.
- Read in components with `useStore(stores.X)` (`src/hooks/useStore.ts`). **Never** copy store data into `useState` and save it back — that was the source of past data-loss bugs. Always write with `update(prev => …)` so you start from the latest value.
- Domain hooks keep stable public APIs: `useGoals`, `useHabits`, `useContacts`, `useWorkouts`, `useSettings`, `useWeeklyPlan`, `useWeeklyFocus`.

### Dates

Use `src/lib/dates.ts` for anything calendar-related (`todayKey`, `toDateKey`, `parseDateKey`, `daysBetween`, `addDays`, …). A date key is the user's LOCAL `YYYY-MM-DD`. Never use `toISOString().slice/split` for dates (it's UTC — ESLint flags it). Components that depend on "today" should use `useTodayKey()` so they update at midnight / when the PWA resumes.

### Schema versioning, backups, recovery

- `src/lib/migrations.ts` — `telos_schema_version` + ordered, idempotent migrations run before React renders (`src/main.tsx`). Shared with backup import. **Any change to a stored shape needs a new migration + test.**
- `src/lib/backup.ts` — versioned backup envelope built from `KEYS` (can't miss a key), validated import with preview, iPhone share-sheet export.
- `src/lib/snapshots.ts` — automatic IndexedDB safety copies (daily + before migration/import/reset/clear).
- `src/components/AppErrorBoundary.tsx` / `RecoveryScreen.tsx` — app-level and per-route crash screens with backup/restore/reset.

### Goal Data Model

Goals have a strict hierarchy:
```
Goal → Phase[] → Task[] → ToDo[] | Habit[]
```
Types and utility functions for this hierarchy live in `src/types/goals.ts`.

### Workout Domain

Workout types are in `src/types/workout.ts`. Core domain logic lives in:
- `src/lib/progressive-overload.ts` — the single source of progression logic: `getProgressionSuggestion` (shown in the UI) and `planNextSession` (applied after logging; increases only, deloads are suggested). Bodyweight lifts progress by reps and their PRs are max reps.
- The workout being logged lives in `stores.ACTIVE_WORKOUT` (`activeWorkoutActions` in `src/hooks/useWorkouts.ts`), so it survives navigation and the app being closed.
- `src/lib/achievements.ts` — badge/milestone evaluation
- `src/lib/strength-standards.ts` — strength benchmarks by bodyweight

### Other domain modules

- `src/lib/goal-plan-parser.ts` — parses AI-written goal plans (tolerant of markdown, missing dates) and merges them into a goal without duplicating phases/tasks/to-dos.
- `src/lib/plan-autofill.ts` — fills a Plan day from routines and due to-dos; blocks remember their source (`sourceTemplateId` / `todoId`) and removed ones are remembered per day in `stores.PLAN_DISMISSED`.

- `src/lib/insights.ts` — weekly summary (Weekly Review), new-record detection, streak milestones, stalled-lift nudges.
- `src/lib/sample-data.ts` — optional first-run sample data, tracked in `telos_sample` so it can be removed in one tap.

Device-only keys (not backed up, not in `KEYS`): `telos-theme`, `telos_onboarded`, `telos_sample`, `telos_dismissed_nudges`.

### Storage Keys

All `localStorage` keys are prefixed `telos_` and listed in `KEYS` in `src/lib/storage.ts` (goals, sessions, exercise configs, weekly plan, settings, achievements, templates, weekly schedule/focus, time blocks, block categories, repeatable blocks, contacts, interactions, commitments, relationship goals, custom exercises, habit logs, goal templates). Meta keys (`telos_schema_version`, `telos_last_export_at`) are excluded from backups.

### Routing & Layout

`src/App.tsx` defines routes: Today `/` (`Index.tsx`), Plan `/plan` (`Program.tsx`), Goals `/goals` and `/goals/:goalId` (`GoalDetail.tsx`), People `/people` and `/people/:contactId` (`PersonDetail.tsx`), Gym `/gym` (`Workouts.tsx`; sections via `?s=progress` / `?s=program`), Settings `/settings`. Old `/program` and `/workouts` redirect. Tab/sidebar labels come from `src/components/layout/nav.ts`. `src/components/layout/AppLayout.tsx` wraps all pages with `AppSidebar` (desktop) and `MobileTabBar` (mobile) plus a per-route error boundary. Every page starts with `PageHeader` (`src/components/app/PageHeader.tsx`), which carries the Settings gear on phones.

Naming: goal templates are **Blueprints**, repeatable Plan blocks are **Routines**, workout templates are **Saved workouts**. Habits are always shown with their goal/task, and live on Today (not duplicated on Plan).

Screen structure:
- Today: `NowCard` (one hero item) + `UpNext` list (`src/components/today/`).
- Goals: list → goal screen; tasks open `TaskSheet` (`src/components/goals/`). Display helpers in `src/lib/goal-meta.ts`.
- People: list by circle → person screen; sheets in `src/components/people/` (`ContactFormSheet`, `LogInteractionSheet`, `CommitmentSheet`). Shared labels/colors in `src/lib/people.ts`.
- Gym: `WorkoutView` (today hero + focused logging), `ProgressView`, `ProgramView` (weekly split + `ExerciseSheet` targets) in `src/components/gym/`. Formatting helpers in `src/lib/gym-format.ts`.
- Plan: week strip + `DailyTimeBlocks` timeline (5 AM → 3 AM; after-midnight blocks store `startHour` 24–26 on the day they belong to — helpers in `src/lib/plan-time.ts`; drag/resize move by the minute, tap-to-add starts on the quarter hour); tapping a block opens `BlockSheet`; `RoutinesSheet` / `CategoriesSheet` in `src/components/plan/`. Routine scheduling: `src/lib/routines.ts`.

### PWA

`vite-plugin-pwa` (config in `vite.config.ts`) generates the manifest and a Workbox service worker that precaches the app, so it opens offline. Updates are `registerType: "prompt"`: `src/components/app/PwaUpdater.tsx` shows a toast and only activates on tap. Icons live in `public/icons/` (regenerate with `node scripts/generate-icons.mjs`). Routes other than Today are `React.lazy`-loaded; the route error boundary reloads once if a stale chunk fails after a deploy. Inter is self-hosted via `@fontsource-variable/inter`. On phones all inputs are forced to 16px (prevents iOS focus-zoom), so the viewport no longer disables zoom. Layout uses `100dvh` and the `.safe-area-top` / `.pb-tabbar` helpers for the notch and home indicator.

### UI

Built on **shadcn/ui** (`src/components/ui/`) over Radix UI primitives, styled with Tailwind. Path alias `@/` maps to `src/`.

- Colors are CSS variables in `src/index.css` with a full `.dark` set. Dark mode follows the phone by default (`next-themes`, `defaultTheme="system"`, storage key `telos-theme`; Settings → Appearance overrides). `ThemeColorSync` keeps the status-bar color in step.
- Use **semantic status tokens** — `success`, `warning`, `destructive`, `info` (e.g. `text-success`, `bg-warning/10`) — never raw `green-500`/`amber-500`/`red-500`. Section accents `coral/teal/violet/amber/sky` keep their token as DEFAULT (`text-amber`) plus Tailwind's shade scale.
- Charts/SVG take colors from CSS vars (`hsl(var(--primary))`, `hsl(var(--border))`), so they work in both themes.
- Type scale (Tailwind `fontSize`): `text-large-title`, `text-title`, `text-headline`, `text-body`, `text-footnote`, `text-caption`; minimum 11px. `cn()` knows these sizes (`src/lib/utils.ts`) — add any new custom size there too, or tailwind-merge will strip text colors.
- Building blocks: `.list-group` (iOS grouped list) with `ListRow`, `.surface` cards, `.section-label` headings, `PageHeader` / `HeaderButton`, `Chips` / `FieldLabel`. Life-area colors: `habits`, `tasks`, `move`, `people`.
- Touch-first: never hide controls behind hover. Row actions go in `RowMenu` (visible ⋯, `src/components/app/RowMenu.tsx`); checks use `CheckCircle` (`src/components/app/ListRow.tsx`, 44px target). `ListRow` is a div with button behavior so rows can contain their own buttons — never nest `<button>`s. Import `Dialog*` from `@/components/app/ResponsiveDialog` (bottom sheet on phones, dialog on desktop), not from `ui/dialog`. Destructive actions offer Undo in the toast; whole goals/people also confirm first.

### TypeScript

The project uses loose TypeScript (`noImplicitAny: false`, `strictNullChecks: false`).

### Testing

Tests use Vitest + jsdom + Testing Library. Config is in `vitest.config.ts`; setup in `src/test/setup.ts` (pins `TZ=America/Los_Angeles`, clears localStorage and stores before each test, uses an in-memory snapshot backend). Use `withTimeZone()` from `src/test/tz.ts` for timezone cases. Tests live next to the code (`*.test.ts[x]`).
