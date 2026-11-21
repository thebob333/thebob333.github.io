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
```

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

### Storage Keys

All `localStorage` keys are prefixed `telos_` and listed in `KEYS` in `src/lib/storage.ts` (goals, sessions, exercise configs, weekly plan, settings, achievements, templates, weekly schedule/focus, time blocks, block categories, repeatable blocks, contacts, interactions, commitments, relationship goals, custom exercises, habit logs, goal templates). Meta keys (`telos_schema_version`, `telos_last_export_at`) are excluded from backups.

### Routing & Layout

`src/App.tsx` defines routes. `src/components/layout/AppLayout.tsx` wraps all pages with `AppSidebar` (desktop) and `MobileTabBar` (mobile). Pages are in `src/pages/`.

### UI

Built on **shadcn/ui** (`src/components/ui/`) over Radix UI primitives, styled with Tailwind. Custom theme colors: coral, teal, violet, amber, sky. Dark mode uses the `class` strategy. Path alias `@/` maps to `src/`.

### TypeScript

The project uses loose TypeScript (`noImplicitAny: false`, `strictNullChecks: false`).

### Testing

Tests use Vitest + jsdom + Testing Library. Config is in `vitest.config.ts`; setup in `src/test/setup.ts` (pins `TZ=America/Los_Angeles`, clears localStorage and stores before each test, uses an in-memory snapshot backend). Use `withTimeZone()` from `src/test/tz.ts` for timezone cases. Tests live next to the code (`*.test.ts[x]`).
