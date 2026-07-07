import { redirect } from "next/navigation";
import { getActiveNutritionPlan, getDraftMealPlan, getActiveMealPlan, getProfile } from "@/lib/session";
import {
  generateMealPlanAction,
  dislikeIngredient,
  acceptMealPlan,
  regenerateWholeMealPlan,
  regenerateDayAction,
  reviseMealPlanAction,
} from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmForm } from "@/components/ConfirmForm";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default async function MealPlanPage() {
  const profile = await getProfile();
  if (!profile) redirect("/onboarding");

  const nutritionPlan = await getActiveNutritionPlan(profile.id);
  if (!nutritionPlan) redirect("/plan/review");

  const mealPlan =
    (await getDraftMealPlan(nutritionPlan.id)) ?? (await getActiveMealPlan(nutritionPlan.id));

  if (!mealPlan) {
    return (
      <div className="mx-auto max-w-md px-6 py-10 text-center">
        <h1 className="text-2xl font-bold">Let&apos;s build your meal plan</h1>
        <p className="mt-2 text-sm text-neutral-500">
          We&apos;ll create a full week of meals that hits your calorie and macro targets.
        </p>
        <form action={generateMealPlanAction} className="mt-6">
          <input type="hidden" name="nutritionPlanId" value={nutritionPlan.id} />
          <input type="hidden" name="profileId" value={profile.id} />
          <SubmitButton
            pendingText="Building your weekly meal plan..."
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            Generate my weekly meal plan
          </SubmitButton>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <h1 className="text-2xl font-bold">Your weekly meal plan</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Tap an ingredient you don&apos;t like to swap it out of that meal.
      </p>

      <div className="mt-6 flex flex-col gap-6">
        {mealPlan.days.map((day) => (
          <div key={day.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <h2 className="font-semibold">{DAY_NAMES[day.dayOfWeek]}</h2>
            <div className="mt-3 flex flex-col gap-4">
              {day.meals.map((meal) => {
                const ingredients: string[] = JSON.parse(meal.ingredients);
                return (
                  <div key={meal.id} className="border-t border-neutral-100 pt-3 first:border-none first:pt-0">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        {meal.type}
                      </span>
                      <span className="text-xs text-neutral-400">{meal.calories} kcal</span>
                    </div>
                    <p className="font-medium">{meal.name}</p>
                    <p className="text-sm text-neutral-500">{meal.description}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {ingredients.map((ingredient) => (
                        <form key={ingredient} action={dislikeIngredient}>
                          <input type="hidden" name="profileId" value={profile.id} />
                          <input type="hidden" name="mealPlanId" value={mealPlan.id} />
                          <input type="hidden" name="ingredient" value={ingredient} />
                          <SubmitButton
                            pendingText="Swapping..."
                            className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 hover:border-red-300 hover:bg-red-50 hover:text-red-600"
                          >
                            <span title="Don't like this">{ingredient} ✕</span>
                          </SubmitButton>
                        </form>
                      ))}
                    </div>
                    <p className="mt-1.5 text-xs text-neutral-400">
                      P {meal.proteinG}g · C {meal.carbsG}g · F {meal.fatG}g · Sugar {meal.sugarG}g · Fiber{" "}
                      {meal.fiberG}g
                    </p>
                  </div>
                );
              })}
            </div>

            <form action={regenerateDayAction} className="mt-3 flex gap-2 border-t border-neutral-100 pt-3">
              <input type="hidden" name="dayId" value={day.id} />
              <input
                type="text"
                name="feedback"
                placeholder={`What do you want changed for ${DAY_NAMES[day.dayOfWeek]}?`}
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-sm"
              />
              <SubmitButton
                pendingText="Updating..."
                className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50"
              >
                Update day
              </SubmitButton>
            </form>
          </div>
        ))}
      </div>

      <form
        action={reviseMealPlanAction}
        className="mt-6 flex flex-col gap-2 rounded-xl border border-neutral-200 bg-white p-4"
      >
        <input type="hidden" name="mealPlanId" value={mealPlan.id} />
        <label className="text-sm font-medium">Feedback on the whole week?</label>
        <textarea
          name="feedback"
          rows={2}
          placeholder="e.g. more variety in lunches, less repetition, swap out red meat"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        />
        <SubmitButton
          pendingText="Rebuilding your week..."
          className="rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50"
        >
          Regenerate with feedback
        </SubmitButton>
      </form>

      {mealPlan.status === "DRAFT" && (
        <form action={acceptMealPlan} className="mt-8">
          <input type="hidden" name="mealPlanId" value={mealPlan.id} />
          <button
            type="submit"
            className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-700"
          >
            Accept my meal plan
          </button>
        </form>
      )}

      <ConfirmForm
        action={regenerateWholeMealPlan}
        confirmMessage="Discard this meal plan and build a new one from scratch? This can't be undone."
        className="mt-3"
      >
        <input type="hidden" name="mealPlanId" value={mealPlan.id} />
        <SubmitButton
          pendingText="Regenerating your whole meal plan..."
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50"
        >
          Not right? Regenerate the whole plan
        </SubmitButton>
      </ConfirmForm>
    </div>
  );
}
