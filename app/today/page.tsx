import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  getActiveMealPlan,
  getActiveNutritionPlan,
  getOrphanedMealLogs,
  getProfile,
  getRecentLoggedDates,
} from "@/lib/session";
import { computeStreak, currentDayOfWeek } from "@/lib/streaks";
import { startOfToday } from "@/lib/meals";
import { StatRing } from "@/components/StatRing";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmForm } from "@/components/ConfirmForm";
import { PortionLogger } from "@/components/PortionLogger";
import { MealRecipeInfo } from "@/components/MealRecipeInfo";
import { FlameIcon } from "@/components/FlameIcon";
import { logMeal, unlogMeal, importRecipeAction, logQuickMeal, removeMealLog } from "./actions";
import { removeMeal } from "@/app/meal-plan/actions";

export const dynamic = "force-dynamic";
// importRecipeAction's web_fetch + logQuickMeal's estimate call can both run
// long enough to need headroom past most serverless platforms' default
// function timeout.
export const maxDuration = 60;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function TodayPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const nutritionPlan = await getActiveNutritionPlan(profile.id);
  if (!nutritionPlan) redirect("/plan/review");

  const mealPlan = await getActiveMealPlan(nutritionPlan.id);
  if (!mealPlan) redirect("/meal-plan");

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86400000);

  const [todaysLogs, allLogs, orphanedLogs] = await Promise.all([
    db.mealLog.findMany({ where: { loggedAt: { gte: today, lt: tomorrow } } }),
    getRecentLoggedDates(),
    getOrphanedMealLogs(),
  ]);
  const loggedMealIds = new Set(todaysLogs.map((l) => l.mealId).filter(Boolean));
  const streak = computeStreak(allLogs.map((l) => l.loggedAt));

  const totals = todaysLogs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      proteinG: acc.proteinG + log.proteinG,
      carbsG: acc.carbsG + log.carbsG,
      fatG: acc.fatG + log.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );

  const day = mealPlan.days.find((d) => d.dayOfWeek === currentDayOfWeek());
  const remainingPrepMinutes = (day?.meals ?? [])
    .filter((meal) => !loggedMealIds.has(meal.id))
    .reduce((sum, meal) => sum + meal.prepMinutes, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[30px] font-bold text-ink">{greeting()}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-2 rounded-full bg-flame/15 px-4 py-2.5">
            <FlameIcon size={14} />
            <span className="text-sm font-bold text-flame-text">
              {streak} day{streak === 1 ? "" : "s"} streak
            </span>
          </div>
        )}
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatRing label="Calories" value={totals.calories} target={nutritionPlan.calories} unit="" metric="calories" />
        <StatRing label="Protein" value={totals.proteinG} target={nutritionPlan.proteinG} unit="g" metric="protein" />
        <StatRing label="Carbs" value={totals.carbsG} target={nutritionPlan.carbsG} unit="g" metric="carbs" />
        <StatRing label="Fat" value={totals.fatG} target={nutritionPlan.fatG} unit="g" metric="fat" />
      </div>

      <div className="mt-7 flex items-baseline justify-between">
        <h2 className="font-display text-[17px] font-semibold text-ink">Today&apos;s meals</h2>
        {remainingPrepMinutes > 0 && (
          <span className="text-xs font-semibold text-ink-soft">⏱ ~{remainingPrepMinutes} min of prep left</span>
        )}
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {day?.meals.length ? (
          day.meals.map((meal) => {
            const logged = loggedMealIds.has(meal.id);
            return (
              <div
                key={meal.id}
                className="rounded-2xl bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-card-hover"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold tracking-wide text-coral-text uppercase">
                      {meal.type}
                    </span>
                    <p className="mt-0.5 font-semibold text-ink">{meal.name}</p>
                    <p className="mt-0.5 text-xs text-ink-faint italic">
                      {meal.calories} kcal (100% portion) · ⏱ {meal.prepMinutes} min
                    </p>
                  </div>
                  {logged ? (
                    <form action={unlogMeal}>
                      <input type="hidden" name="mealId" value={meal.id} />
                      <SubmitButton
                        pendingText="Un-logging..."
                        className="rounded-full bg-primary/15 px-4 py-2 text-sm font-bold text-primary-hover"
                      >
                        ✓ Logged
                      </SubmitButton>
                    </form>
                  ) : (
                    <PortionLogger mealId={meal.id} calories={meal.calories} action={logMeal} />
                  )}
                </div>

                <MealRecipeInfo sourceUrl={meal.sourceUrl} notes={meal.notes} />

                <form action={importRecipeAction} className="mt-3 flex gap-2 border-t border-border-light pt-3">
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input
                    type="url"
                    name="url"
                    placeholder="Paste a recipe link to use instead"
                    className="flex-1 rounded-lg border border-border-light px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
                  />
                  <SubmitButton
                    pendingText="Reading recipe..."
                    className="rounded-lg border border-border-light px-3 py-1.5 text-sm font-medium hover:bg-app-bg/60"
                  >
                    Import
                  </SubmitButton>
                </form>

                <ConfirmForm
                  action={removeMeal}
                  confirmMessage={`Remove "${meal.name}" from your plan? This can't be undone.`}
                  className="mt-2 text-right"
                >
                  <input type="hidden" name="mealId" value={meal.id} />
                  <SubmitButton
                    pendingText="Removing..."
                    className="text-xs font-medium text-ink-faint hover:text-coral-text"
                  >
                    Remove meal
                  </SubmitButton>
                </ConfirmForm>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-ink-faint">No meals scheduled for today.</p>
        )}
      </div>

      <div className="mt-5 flex items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border-light p-4">
        <form action={logQuickMeal} className="flex flex-1 gap-2.5">
          <input
            type="text"
            name="description"
            required
            placeholder="Ate something else? e.g. cheese toastie"
            className="flex-1 rounded-lg border border-border-light bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          />
          <SubmitButton
            pendingText="Adding..."
            className="rounded-lg bg-sidebar px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            Add
          </SubmitButton>
        </form>
      </div>

      {orphanedLogs.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-4">
          <p className="text-[13px] font-semibold text-ink-soft">Logged meals no longer on your plan</p>
          <p className="mt-0.5 text-xs text-ink-faint">
            Their meal was later regenerated, but the log itself was kept so your history stays accurate — each
            still counts toward the day it was logged. Remove any that shouldn&apos;t.
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {orphanedLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 border-t border-border-light pt-2 first:border-none first:pt-0">
                <div>
                  <p className="text-sm font-medium text-ink">{log.name}</p>
                  <p className="text-xs text-ink-faint">
                    {log.calories} kcal · {log.loggedAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </p>
                </div>
                <form action={removeMealLog}>
                  <input type="hidden" name="logId" value={log.id} />
                  <SubmitButton
                    pendingText="Removing..."
                    className="rounded-full border border-border-light px-3 py-1.5 text-xs text-ink-soft hover:border-coral/50 hover:text-coral-text"
                  >
                    Remove
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
