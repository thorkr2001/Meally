import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getActiveMealPlan, getActiveNutritionPlan, getProfile } from "@/lib/session";
import { currentDayOfWeek } from "@/lib/streaks";
import { startOfToday } from "@/lib/meals";
import { StatRing } from "@/components/StatRing";
import { SubmitButton } from "@/components/SubmitButton";
import { PortionLogger } from "@/components/PortionLogger";
import { MealRecipeInfo } from "@/components/MealRecipeInfo";
import { logMeal, unlogMeal, importRecipeAction, logQuickMeal } from "./actions";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const nutritionPlan = await getActiveNutritionPlan(profile.id);
  if (!nutritionPlan) redirect("/plan/review");

  const mealPlan = await getActiveMealPlan(nutritionPlan.id);
  if (!mealPlan) redirect("/meal-plan");

  const today = startOfToday();
  const tomorrow = new Date(today.getTime() + 86400000);

  const todaysLogs = await db.mealLog.findMany({
    where: { loggedAt: { gte: today, lt: tomorrow } },
  });
  const loggedMealIds = new Set(todaysLogs.map((l) => l.mealId).filter(Boolean));

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

  return (
    <div className="mx-auto max-w-md px-6 py-8">
      <h1 className="text-2xl font-bold">Today</h1>

      <div className="mt-6 grid grid-cols-4 gap-2 rounded-xl border border-neutral-200 bg-white p-4">
        <StatRing label="Calories" value={totals.calories} target={nutritionPlan.calories} unit="" metric="calories" />
        <StatRing label="Protein" value={totals.proteinG} target={nutritionPlan.proteinG} unit="g" metric="protein" />
        <StatRing label="Carbs" value={totals.carbsG} target={nutritionPlan.carbsG} unit="g" metric="carbs" />
        <StatRing label="Fat" value={totals.fatG} target={nutritionPlan.fatG} unit="g" metric="fat" />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        {day?.meals.length ? (
          day.meals.map((meal) => {
            const logged = loggedMealIds.has(meal.id);
            return (
              <div key={meal.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                      {meal.type}
                    </span>
                    <p className="font-medium">{meal.name}</p>
                    <p className="text-xs text-neutral-400">{meal.calories} kcal (100% portion)</p>
                  </div>
                  {logged ? (
                    <form action={unlogMeal}>
                      <input type="hidden" name="mealId" value={meal.id} />
                      <SubmitButton
                        pendingText="Un-logging..."
                        className="rounded-full bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-200"
                      >
                        ✓ Logged (undo)
                      </SubmitButton>
                    </form>
                  ) : (
                    <PortionLogger mealId={meal.id} calories={meal.calories} action={logMeal} />
                  )}
                </div>

                <MealRecipeInfo sourceUrl={meal.sourceUrl} notes={meal.notes} />

                <form
                  action={importRecipeAction}
                  className="mt-3 flex gap-2 border-t border-neutral-100 pt-3"
                >
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input
                    type="url"
                    name="url"
                    placeholder="Paste a recipe link to use instead"
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
                  />
                  <SubmitButton
                    pendingText="Reading recipe..."
                    className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
                  >
                    Import
                  </SubmitButton>
                </form>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-neutral-500">No meals scheduled for today.</p>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-white p-4">
        <p className="text-sm font-medium text-neutral-600">Ate something else?</p>
        <p className="mt-0.5 text-xs text-neutral-400">
          Plans change — quickly add anything not on your plan. We&apos;ll estimate the nutrition and add it
          here (and to your meal plan) so you can adjust the portion and log it like any other meal.
        </p>
        <form action={logQuickMeal} className="mt-3 flex gap-2">
          <input
            type="text"
            name="description"
            required
            placeholder="e.g. cheese toastie and an apple"
            className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
          <SubmitButton
            pendingText="Adding..."
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Add
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
