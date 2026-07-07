---
name: verify
description: Launch and drive Meally to observe a change actually working (not just typecheck/build).
---

# Verifying Meally at runtime

Meally is a single-user (no auth) Next.js app with a real local SQLite DB and
real Anthropic API calls. The dev server is usually already running —
check before starting a second one.

## Launch

```bash
netstat -ano | grep ":3000" | grep LISTENING   # check first
npm run dev                                     # http://localhost:3000
```

If port 3000 is already bound by a stale process, `taskkill //F //PID <pid>`
before restarting (Windows). After a Prisma migration, the dev server must be
stopped first — see CLAUDE.md's Windows/SQLite gotcha.

## Driving it

No `verifier-*`/browser-automation skill exists yet in this repo. Use
Playwright directly (chromium only needed):

```bash
cd <scratchpad>/pwtest   # or any scratch dir
npm install playwright
npx playwright install chromium
node your-script.js
```

Reuse the pattern from earlier sessions: `chromium.launch()`, navigate with
`waitUntil: "domcontentloaded"` (never `"networkidle"` — Next dev's HMR
websocket never idles, so networkidle hangs), `page.waitForSelector(...)` for
real waits, screenshot with `fullPage: true`.

**Known non-bug console noise:** a hydration warning about
`style={{caret-color:"transparent"}}` on inputs is injected by the headless
Chromium automation itself, not app code (confirmed via grep — nothing in the
repo sets `caret-color`). Ignore it.

## The single-user DB is REAL data, not a fixture

There's exactly one `Profile` row, and it's the actual person's real diet/health
data (conditions, meal plan, logs) — not a disposable test fixture. Before
driving any flow that mutates it:

- **Read-only checks** (does a link render, does a `required` attribute
  block submission, does a page load) → drive the real app directly, zero risk.
- **Anything that calls the Anthropic API** (generate/regenerate a plan,
  dislike an ingredient, import a recipe, quick-log) → costs real money on
  the user's key and can alter their actual meal plan content. Don't trigger
  these just to verify a fix unless the user has explicitly signed off, or the
  fix is unverifiable any other way.
- **DB-transaction-shape bugs** (e.g. "does regenerating a day accidentally
  delete history?") → verify with an **isolated throwaway fixture** against
  the real `PrismaClient`, not the user's real rows: create a scratch
  `MealPlanDay` with an out-of-range `dayOfWeek` (e.g. `999` — the real app
  only ever looks up 0-6, so it's invisible to every page/query), attach
  scratch `Meal`/`MealLog` rows under it, run the *exact* transaction the
  real action runs, assert, then delete every fixture row in a `finally`.
  This exercises the real persistence code without an API call or any risk
  to production data. Run Node scripts **from the project root** (`cd` into
  it first) so `require("@prisma/client")` resolves — a script located
  elsewhere (e.g. a scratchpad dir) won't find the project's `node_modules`.

## Useful one-off DB inspection

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const profile = await db.profile.findFirst();
  console.log(profile);
  await db.\$disconnect();
})();
"
```

## Gotchas hit before

- Node's timezone is the machine's real local timezone (not UTC) — relevant
  when testing anything date/streak related. Check `new Date().getTimezoneOffset()`
  before assuming a UTC-vs-local bug is/isn't reachable.
- `git diff @{upstream}...HEAD` is empty right after a push — that's expected,
  not a sign there's nothing to verify. Diff the specific commit
  (`git diff HEAD~1..HEAD`) instead.
