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

**Windows/SQLite gotcha:** `npx prisma migrate dev` can fail with `EPERM` on
`query_engine-windows.dll` if the dev server is currently running (it holds the
file open). Stop the dev server first, run the migration, run
`npx prisma generate`, then restart the dev server.

Requires `ANTHROPIC_API_KEY` in `.env` to actually call Claude (nutrition plan,
meal plan, recipe import, quick-log, progress feedback all hit the live API —
without a key those flows fail, but the rest of the app still runs).

## Architecture

### Single-user model, no auth

Exactly one `Profile` row is assumed to exist; `lib/session.ts`'s `getProfile()`
fetches the first one by `createdAt`. `app/page.tsx` is the router: it redirects
to `/onboarding`, `/plan/review`, `/meal-plan`, or `/today` depending on which of
Profile / accepted NutritionPlan / accepted MealPlan exist yet.

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

### Progress tracking

`lib/progress.ts` is pure deterministic logic (no AI) evaluating each day's
logged totals against `NutritionPlan` targets, with different pass/fail
semantics per metric: calories/carbs/fat use a ±15% band, protein/fiber only
flag "under" (they're minimums), sugar only flags "over" (it's a ceiling). The
AI narrative on top (`lib/ai/progressFeedback.ts`) is cached in the
`ProgressFeedback` table (one row per profile, upserted) and only regenerated
when the user clicks the button — never automatically, to control API cost.
