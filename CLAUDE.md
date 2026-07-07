# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # start dev server (localhost:3000)
npm run build             # production build (also type-checks)
npm run lint               # eslint
npx tsc --noEmit -p .      # type-check only, no build
npx prisma migrate dev --name <name>   # create + apply a schema migration
npx prisma generate        # regenerate the Prisma client (needed if migrate's own generate step fails)
```

No test suite is configured in this repo.

**Windows gotcha:** `npx prisma migrate dev` (or a bare `prisma generate`) can
fail with `EPERM` on `query_engine-windows.dll` if the dev server is currently
running — it holds that engine binary open regardless of which database
provider is configured. Stop the dev server first, run the migration/generate,
then restart the dev server.

Requires `ANTHROPIC_API_KEY` in `.env` to actually call Claude (nutrition plan,
meal plan, recipe import, quick-log, progress feedback all hit the live API —
without a key those flows fail, but the rest of the app still runs).

## Architecture

### Single-user model, no auth

Exactly one `Profile` row is assumed to exist; `lib/session.ts`'s `getProfile()`
fetches the first one by `createdAt`. `app/page.tsx` is the router: it redirects
to `/onboarding`, `/plan/review`, `/meal-plan`, or `/today` depending on which of
Profile / accepted NutritionPlan / accepted MealPlan exist yet.

There is deliberately no per-visitor isolation — anyone hitting the deployed
URL gets the same shared database and the same one profile, full read/write
(they'd land straight on `/today` too, since a profile already exists).
`middleware.ts` is the mitigation for this once deployed publicly: it gates
every route behind a single shared password (`SITE_PASSWORD` env var, hashed
into a cookie by `app/login/actions.ts`) rather than building real multi-user
auth, since real auth would contradict the single-profile model everywhere
else in the app. No `SITE_PASSWORD` set → no gate (intentional for local dev).

Every data-dependent page must declare `export const dynamic = "force-dynamic"`
— otherwise Next statically prerenders it at build time against whatever DB
state exists then, which silently breaks correctness for a mutating app like
this (caught once already: `/` cached a stale onboarding redirect).

### Data model chain

`Profile` → `NutritionPlan` (calorie/macro targets + AI research notes) →
`MealPlan` → `MealPlanDay` (one per weekday) → `Meal` → `MealLog` (actual
consumption, portion-scaled). `DislikedIngredient` rows and
`Profile.dietaryPreferences` (JSON-encoded `string[]`) are both threaded into
every meal-generation prompt.

### Server Actions, not API routes

All mutations are Server Actions in `app/*/actions.ts` files (`"use server"`),
invoked directly as a `<form action={...}>` — there are no separate API route
handlers for app mutations.

### AI layer (`lib/ai/*`)

- Two Claude models are used deliberately (`lib/ai/client.ts`): `MODEL`
  (`claude-opus-4-8`) for nutrition research/plan generation, where reasoning
  quality matters; `MEAL_PLAN_MODEL` (`claude-sonnet-5`) for every meal-related
  call (full plan, single meal, single day, revisions, recipe import,
  quick-log) since those are high-volume and don't need frontier-tier
  reasoning. Keep new AI calls on whichever side matches this cost/quality
  split rather than defaulting both to one model.
- Structured output is always a forced tool call
  (`tool_choice: {type: "tool", name: ...}`), never freeform-text parsing.
- Forcing a tool means Claude can't call another tool in the same request — so
  anywhere research is needed (`web_search` in `nutritionPlan.ts`, `web_fetch`
  in `recipeImport.ts`) it's always two sequential calls: an untooled/auto-tool
  research call first, then a separate forced-tool call that gets the research
  output folded in as plain-text context to shape the final JSON.
- `nutritionPlan.ts`'s `researchConditions()` extracts real citation URLs from
  response text blocks' `citations` array (populated automatically by
  `web_search`) into a `Sources:` list — don't rely on the model to write real
  URLs into prose unprompted.
- `mealPlan.ts` exports `MEAL_SCHEMA` and `MealResult`, reused by
  `recipeImport.ts` and `quickLog.ts` so a quick-added or recipe-imported meal
  is structurally identical to a normally-generated one.
- Prompts are written to be concise on purpose (word/sentence caps on
  descriptions and research notes) — output tokens cost several times more
  than input tokens, and this is a real per-user cost the app owner is
  tracking, not a style preference.
- Static instruction text (constraint/realism/variety notes, research
  methodology, the final tool-call instruction) is sent via `system` with a
  `cache_control: {type: "ephemeral"}` breakpoint, never interpolated into the
  per-call prompt string — this lets repeated same-scope calls (e.g. three
  `regenerateMeal` calls firing from one `dislikeIngredient` action, or
  several `reviseMealPlan` calls in one editing session) read that prefix
  from cache instead of paying full input-token price every time. Keep this
  split (static → `system`, per-call data → the user message) for any new AI
  call; changing the tool set or model between calls invalidates the cache
  entirely, so it only pays off for repeated calls of the *same* function.
- `lib/ai/mealPlan.ts` also grounds meal suggestions in real-world data: a
  `researchMealFacts()` call (`web_search`, capped per scope — 2 searches for
  a single meal, 4 for a day, 10 for a full week) proposes and verifies real
  dishes' prep time and nutrition *before* the forced-tool call that returns
  the final `MealResult`(s), so `prepMinutes`/calories are checked against
  actual sources rather than the model's own guess.

### `lib/session.ts` vs `lib/meals.ts`

- `lib/session.ts`: read-only query helpers (`getProfile`,
  `getActive/DraftNutritionPlan`, `getActive/DraftMealPlan`,
  `getDislikedNames`) shared by pages and actions.
- `lib/meals.ts`: pure mapping helpers between a Prisma `Meal` row and the AI
  `MealResult` shape (`toMealResult`, `mealFields`) plus `startOfToday()` —
  used by `app/meal-plan/actions.ts` and `app/today/actions.ts` so the three
  meal-mutating flows (plan generation, recipe import, quick-add) stay
  consistent instead of drifting apart.

### Portion & logging model

A `Meal`'s stored macros represent a 100%-portion baseline. Logging
(`logMeal` in `app/today/actions.ts`) always scales by a `portion` percentage
from the form before writing a `MealLog` row — the `MealLog`'s own numbers are
the actual-consumed amount, already scaled, not the meal's baseline.
Un-logging (`unlogMeal`) deletes today's `MealLog` row(s) for that meal id.
Quick-added ad-hoc meals ("Ate something else?") are inserted as a real `Meal`
on today's `MealPlanDay` (not a standalone log), so they get full parity with
planned meals: portion slider, recipe import, un-log.

### Feedback persistence

Free-text feedback typed into "regenerate day" / "regenerate week" is passed
to the AI for that one call *and* also appended to
`Profile.dietaryPreferences` (`savePreference()` in `app/meal-plan/actions.ts`)
so it becomes a standing constraint for every future generation — otherwise
it's forgotten the moment that one call completes. It's visible and
individually removable on the Profile page's "Your food preferences" list.

### Layout & navigation

`components/AppShell.tsx` decides per-route whether to render the desktop
sidebar shell (`components/Sidebar.tsx`, `hidden md:flex`) or let
`components/BottomNav.tsx` (`md:hidden`, fixed to the viewport bottom) take
over on phones/small tablets — both read the same tab list from
`components/navTabs.tsx` so adding a nav destination means editing one file,
not two. `/onboarding` and `/plan/*` opt out of the shell entirely (centered
card, no nav) via `AppShell`'s `NO_SHELL_PREFIXES` check. The outer shell's
rounding/shadow/padding (`sm:rounded-[28px] sm:shadow-shell` etc. in
`AppShell.tsx`, `sm:px-5 sm:py-8` in `app/layout.tsx`) only applies at `sm`+
— below that the app is edge-to-edge, not a shrunk floating card.

### Progress tracking

`lib/progress.ts` is pure deterministic logic (no AI) evaluating each day's
logged totals against `NutritionPlan` targets, with different pass/fail
semantics per metric: calories/carbs/fat use a ±15% band, protein/fiber only
flag "under" (they're minimums), sugar only flags "over" (it's a ceiling). The
AI narrative on top (`lib/ai/progressFeedback.ts`) is cached in the
`ProgressFeedback` table (one row per profile, upserted) and only regenerated
when the user clicks the button — never automatically, to control API cost.

## Database: Supabase Postgres

The app runs on Supabase Postgres (`prisma/schema.prisma`'s
`datasource db { provider = "postgresql" }`), migrated from an earlier local
SQLite prototype. `DATABASE_URL` is the **pooled** connection (port 6543,
`?pgbouncer=true`) used by the app at runtime — serverless functions can't
hold long-lived connections. `DIRECT_URL` is the **direct** connection (port
5432), used only when running migrations, since pgbouncer's transaction mode
breaks Prisma's migration engine. Both live in `.env` locally and as Vercel
project env vars in production — see `.env.example` for the shape.

`prisma/migrations/` starts from `20260707221435_init_postgres` — the earlier
SQLite-era migration history was deleted rather than translated, since SQLite
migrations don't apply to Postgres; this is intentional, not a gap.

`lib/session.ts`'s case-insensitive disliked-ingredient dedup
(`addDislikedIngredientIfNew`) could in principle be replaced by a Postgres
citext/functional index now that SQLite's lack of one is no longer the
constraint — left as-is since the existing JS-side check still works
correctly on Postgres and isn't worth the migration.

`scripts/export-data.ts` / `scripts/import-data.ts` are the general-purpose
backup/restore pair used for this migration (JSON dump of every table in
FK-safe order); keep them around for any future re-platforming, not just
one-off use.

### Deploying to Vercel

Import the GitHub repo at vercel.com/new — Next.js is auto-detected, no
`vercel.json` needed. Set `DATABASE_URL`, `DIRECT_URL`, `ANTHROPIC_API_KEY`,
and **`SITE_PASSWORD`** in the project's Settings → Environment Variables
(same values as local `.env`) — the last one is what keeps the deployed URL
from being wide open to anyone who finds it, since the app has no other auth.
Then deploy. `package.json`'s
`postinstall: "prisma generate"` script makes sure the Prisma client
regenerates on every Vercel build. Four pages (`onboarding`, `plan/review`,
`meal-plan`, `today`) export `maxDuration = 60` since their Server Actions run
a `web_search` research call before their forced-tool call, which can
comfortably exceed most serverless platforms' default function timeout.
